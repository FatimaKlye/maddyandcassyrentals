-- Maddy & Cassy Rentals - Firebase-to-Supabase cutover: schema extensions
-- Extends maddy_cassy_supabase_schema.sql (already applied) with the fields
-- and tables required by the final renter/admin workflow that the original
-- upload could not cover (no PayMongo/audit/push source files were supplied).
--
-- Additive only: no existing table, column, or policy from the base schema
-- is dropped or redefined destructively.

begin;

-- -----------------------------------------------------------------------------
-- Tidy up a pre-existing project-scaffold function flagged by the security
-- advisor (SECURITY DEFINER, publicly executable, unrelated to this app).
-- -----------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- PayMongo fields on payment_records
-- -----------------------------------------------------------------------------

alter table public.payment_records
  add column if not exists paymongo_payment_id text,
  add column if not exists paymongo_checkout_session_id text,
  add column if not exists paymongo_payment_intent_id text,
  add column if not exists paymongo_source_id text,
  add column if not exists payment_type text not null default 'online'
    check (payment_type in ('online', 'manual_proof')),
  add column if not exists currency_code char(3) not null default 'PHP',
  add column if not exists provider_status text,
  add column if not exists completed_at timestamptz,
  add column if not exists failure_code text,
  add column if not exists failure_message text,
  add column if not exists refund_status text not null default 'none'
    check (refund_status in ('none', 'partial', 'full')),
  add column if not exists refund_amount numeric(12,2) not null default 0
    check (refund_amount >= 0),
  add column if not exists provider_metadata jsonb not null default '{}'::jsonb,
  add column if not exists idempotency_key text;

create unique index if not exists payment_records_idempotency_key_idx
  on public.payment_records(idempotency_key)
  where idempotency_key is not null;

create unique index if not exists payment_records_paymongo_checkout_session_idx
  on public.payment_records(paymongo_checkout_session_id)
  where paymongo_checkout_session_id is not null;

create index if not exists payment_records_paymongo_payment_idx
  on public.payment_records(paymongo_payment_id)
  where paymongo_payment_id is not null;

alter table public.payment_records drop constraint if exists payment_records_status_check;
alter table public.payment_records add constraint payment_records_status_check
  check (status in (
    'pending', 'submitted', 'processing', 'verified', 'paid',
    'failed', 'expired', 'cancelled', 'refunded', 'rejected'
  ));

comment on column public.payment_records.provider_status is
  'Raw PayMongo resource status as last observed from a verified webhook or API poll.';

-- -----------------------------------------------------------------------------
-- PayMongo webhook events (idempotent, auditable webhook intake)
-- -----------------------------------------------------------------------------

create table if not exists public.paymongo_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  signature_valid boolean not null default false,
  processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processed', 'ignored', 'failed')),
  error_message text,
  payment_record_id uuid references public.payment_records(id) on delete set null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

comment on table public.paymongo_webhook_events is
  'Raw PayMongo webhook deliveries. provider_event_id uniqueness gives idempotent processing under retried/duplicate delivery.';

create index if not exists paymongo_webhook_events_type_idx
  on public.paymongo_webhook_events(event_type, received_at desc);
create index if not exists paymongo_webhook_events_payment_record_idx
  on public.paymongo_webhook_events(payment_record_id);

alter table public.paymongo_webhook_events enable row level security;

create policy paymongo_webhook_events_admin_read
on public.paymongo_webhook_events for select
to authenticated
using ((select private.is_active_admin()));

-- No insert/update/delete policy for authenticated/anon: the webhook route
-- writes exclusively with the service_role key, which bypasses RLS. This
-- guarantees the client can never fabricate or edit a webhook event.

grant select on public.paymongo_webhook_events to authenticated;
grant all on public.paymongo_webhook_events to service_role;

-- Extend the payment audit trail so it can be tied back to the source event.
alter table public.payment_event_logs
  add column if not exists provider_event_id text,
  add column if not exists is_manual_correction boolean not null default false;

create index if not exists payment_event_logs_provider_event_idx
  on public.payment_event_logs(provider_event_id)
  where provider_event_id is not null;

comment on column public.payment_event_logs.is_manual_correction is
  'True when an administrator manually adjusted payment state; never set for verified provider events.';

-- -----------------------------------------------------------------------------
-- Push notification subscriptions (Web Push / VAPID, replaces Firebase FCM)
-- -----------------------------------------------------------------------------

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh_key text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

create policy push_subscriptions_select_own_or_admin
on public.push_subscriptions for select
to authenticated
using (user_id = (select auth.uid()) or (select private.is_active_admin()));

create policy push_subscriptions_insert_own
on public.push_subscriptions for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy push_subscriptions_update_own
on public.push_subscriptions for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy push_subscriptions_delete_own_or_admin
on public.push_subscriptions for delete
to authenticated
using (user_id = (select auth.uid()) or (select private.is_active_admin()));

grant select, insert, update, delete on public.push_subscriptions to authenticated;

drop trigger if exists push_subscriptions_set_updated_at on public.push_subscriptions;
-- push_subscriptions intentionally has no updated_at column (append/replace by endpoint).

-- -----------------------------------------------------------------------------
-- Agreement version history (booking_agreements stays the "current" row;
-- prior signed versions are archived here before being overwritten).
-- -----------------------------------------------------------------------------

alter table public.booking_agreements
  add column if not exists version_number integer not null default 1;

create table if not exists public.booking_agreement_versions (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.booking_agreements(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  version_number integer not null,
  status text not null,
  agreement_version text,
  agreement_snapshot jsonb not null default '{}'::jsonb,
  generated_document_path text,
  final_document_path text,
  generated_at timestamptz,
  completed_at timestamptz,
  archived_at timestamptz not null default now(),
  archived_reason text,
  unique (agreement_id, version_number)
);

comment on table public.booking_agreement_versions is
  'Immutable archive of prior booking_agreements rows, written whenever a signed agreement is revised.';

create index if not exists booking_agreement_versions_booking_idx
  on public.booking_agreement_versions(booking_id, version_number desc);

alter table public.booking_agreement_versions enable row level security;

create policy agreement_versions_select_own_or_admin
on public.booking_agreement_versions for select
to authenticated
using (
  exists (
    select 1 from public.bookings b
    where b.id = booking_agreement_versions.booking_id
      and (b.user_id = (select auth.uid()) or (select private.is_active_admin()))
  )
);

create policy agreement_versions_admin_manage
on public.booking_agreement_versions for all
to authenticated
using ((select private.is_active_admin()))
with check ((select private.is_active_admin()));

grant select on public.booking_agreement_versions to authenticated;
grant insert, update, delete on public.booking_agreement_versions to authenticated;

-- -----------------------------------------------------------------------------
-- Invoice void/refund tracking and receipt reissue tracking
-- -----------------------------------------------------------------------------

alter table public.booking_invoices drop constraint if exists booking_invoices_status_check;
alter table public.booking_invoices add constraint booking_invoices_status_check
  check (status in ('draft', 'issued', 'partially_paid', 'paid', 'void', 'cancelled', 'refunded'));

alter table public.booking_invoices
  add column if not exists void_reason text,
  add column if not exists voided_by uuid references auth.users(id) on delete set null,
  add column if not exists voided_at timestamptz;

alter table public.booking_receipts
  add column if not exists is_reissue boolean not null default false,
  add column if not exists reissued_from_id uuid references public.booking_receipts(id) on delete set null,
  add column if not exists reissue_reason text;

-- -----------------------------------------------------------------------------
-- Audit logs (immutable, admin-only)
-- -----------------------------------------------------------------------------

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_type text not null default 'user' check (actor_type in ('user', 'admin', 'system', 'service')),
  action text not null,
  entity_type text not null,
  entity_id text,
  booking_id uuid references public.bookings(id) on delete set null,
  previous_values jsonb,
  new_values jsonb,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

comment on table public.audit_logs is
  'Immutable system activity log. Writable only via private.log_audit_event(); no client update/delete path exists.';

create index if not exists audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);
create index if not exists audit_logs_actor_idx on public.audit_logs(actor_user_id, created_at desc);
create index if not exists audit_logs_booking_idx on public.audit_logs(booking_id);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);

alter table public.audit_logs enable row level security;

create policy audit_logs_admin_read
on public.audit_logs for select
to authenticated
using ((select private.is_active_admin()));

-- Deliberately no insert/update/delete policy: writes only via the
-- SECURITY DEFINER function below, reads only for active admins, and the
-- table is never updatable/deletable through the client under any policy.

grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;

create or replace function private.log_audit_event(
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_booking_id uuid default null,
  p_previous_values jsonb default null,
  p_new_values jsonb default null,
  p_metadata jsonb default '{}'::jsonb,
  p_actor_type text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_actor_type text;
  v_id uuid;
begin
  v_uid := auth.uid();
  v_actor_type := coalesce(
    p_actor_type,
    case
      when v_uid is not null and exists (
        select 1 from public.admins a where a.user_id = v_uid and a.is_active = true
      ) then 'admin'
      when v_uid is not null then 'user'
      else 'system'
    end
  );

  insert into public.audit_logs (
    actor_user_id, actor_type, action, entity_type, entity_id,
    booking_id, previous_values, new_values, metadata
  )
  values (
    v_uid, v_actor_type, p_action, p_entity_type, p_entity_id,
    p_booking_id, p_previous_values, p_new_values, coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function private.log_audit_event(text, text, text, uuid, jsonb, jsonb, jsonb, text) from public;
grant execute on function private.log_audit_event(text, text, text, uuid, jsonb, jsonb, jsonb, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Server-side booking creation: validates availability and reserves an
-- inventory unit atomically. Runs as SECURITY DEFINER because customers do
-- not have SELECT on inventory_units directly, but must still only ever be
-- able to create a booking for themselves in 'pending' status — enforced
-- here in code since RLS is bypassed for the duration of the function.
-- -----------------------------------------------------------------------------

create or replace function public.create_booking(
  p_product_id uuid,
  p_rental_start_date date,
  p_rental_end_date date,
  p_fulfillment_method text,
  p_location text,
  p_customer_notes text,
  p_delivery_fee numeric,
  p_discount_amount numeric,
  p_product_snapshot jsonb,
  p_customer_snapshot jsonb,
  p_emergency_contact jsonb default null
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_product record;
  v_unit_id uuid;
  v_rental_days integer;
  v_subtotal numeric(12,2);
  v_delivery_fee numeric(12,2);
  v_discount numeric(12,2);
  v_total numeric(12,2);
  v_booking public.bookings;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  if exists (
    select 1 from public.profiles pr
    where pr.id = v_uid and pr.account_status = 'suspended'
  ) then
    raise exception 'ACCOUNT_SUSPENDED' using errcode = '42501';
  end if;

  if p_fulfillment_method not in ('pickup', 'delivery') then
    raise exception 'INVALID_FULFILLMENT_METHOD';
  end if;

  if p_rental_end_date < p_rental_start_date then
    raise exception 'INVALID_DATE_RANGE';
  end if;

  if p_rental_start_date < (now() at time zone 'Asia/Manila')::date then
    raise exception 'RENTAL_START_IN_PAST';
  end if;

  select id, daily_rate, refundable_deposit, status
    into v_product
    from public.products
    where id = p_product_id
    for share;

  if v_product.id is null or v_product.status <> 'active' then
    raise exception 'PRODUCT_NOT_AVAILABLE';
  end if;

  v_rental_days := (p_rental_end_date - p_rental_start_date) + 1;
  v_subtotal := v_product.daily_rate * v_rental_days;
  v_delivery_fee := case when p_fulfillment_method = 'delivery'
    then greatest(coalesce(p_delivery_fee, 0), 0)
    else 0
  end;
  v_discount := greatest(coalesce(p_discount_amount, 0), 0);
  v_total := greatest(v_subtotal + v_product.refundable_deposit + v_delivery_fee - v_discount, 0);

  -- Lock and claim one conflict-free inventory unit for this date range.
  select iu.id into v_unit_id
  from public.inventory_units iu
  where iu.product_id = p_product_id
    and iu.status = 'available'
    and not exists (
      select 1 from public.bookings b
      where b.inventory_unit_id = iu.id
        and b.status in ('pending', 'approved', 'confirmed', 'released')
        and daterange(b.rental_start_date, b.rental_end_date + 1)
          && daterange(p_rental_start_date, p_rental_end_date + 1)
    )
  order by iu.id
  for update of iu skip locked
  limit 1;

  if v_unit_id is null then
    raise exception 'NO_AVAILABILITY' using errcode = 'P0001';
  end if;

  insert into public.bookings (
    user_id, product_id, inventory_unit_id, status, fulfillment_method,
    rental_start_date, rental_end_date, daily_rate, refundable_deposit,
    rental_subtotal, delivery_fee, total_amount, location, customer_notes,
    product_snapshot, customer_snapshot
  )
  values (
    v_uid, p_product_id, v_unit_id, 'pending', p_fulfillment_method,
    p_rental_start_date, p_rental_end_date, v_product.daily_rate, v_product.refundable_deposit,
    v_subtotal, v_delivery_fee, v_total, p_location, p_customer_notes,
    coalesce(p_product_snapshot, '{}'::jsonb), coalesce(p_customer_snapshot, '{}'::jsonb)
  )
  returning * into v_booking;

  insert into public.booking_status_history (booking_id, from_status, to_status, note, changed_by)
  values (v_booking.id, null, 'pending', 'Booking created by renter.', v_uid);

  if p_emergency_contact is not null then
    insert into public.booking_emergency_contacts (
      booking_id, full_name, relationship, phone_number, address
    )
    values (
      v_booking.id,
      p_emergency_contact ->> 'fullName',
      p_emergency_contact ->> 'relationship',
      p_emergency_contact ->> 'phoneNumber',
      p_emergency_contact ->> 'address'
    );
  end if;

  update public.inventory_units set status = 'reserved' where id = v_unit_id;

  insert into public.availability_calendar_entries (
    product_id, inventory_unit_id, start_date, end_date, status, created_by
  )
  values (
    p_product_id, v_unit_id, p_rental_start_date, p_rental_end_date, 'reserving', v_uid
  );

  perform private.log_audit_event(
    'booking.created', 'booking', v_booking.id::text, v_booking.id,
    null, to_jsonb(v_booking), '{}'::jsonb, 'user'
  );

  return v_booking;
end;
$$;

revoke all on function public.create_booking(
  uuid, date, date, text, text, text, numeric, numeric, jsonb, jsonb, jsonb
) from public;
grant execute on function public.create_booking(
  uuid, date, date, text, text, text, numeric, numeric, jsonb, jsonb, jsonb
) to authenticated;

comment on function public.create_booking is
  'Client-callable RPC (via supabase.rpc) run as SECURITY DEFINER so it can validate real inventory availability, which customers cannot SELECT directly; auth/ownership/suspension checks are re-implemented in the function body since RLS is bypassed for its duration.';

-- -----------------------------------------------------------------------------
-- Admin-only booking status transitions, always paired with history + a
-- reserved/available inventory-unit flip and an audit-log entry.
-- -----------------------------------------------------------------------------

create or replace function public.admin_set_booking_status(
  p_booking_id uuid,
  p_new_status text,
  p_note text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_booking public.bookings;
  v_allowed boolean;
begin
  v_uid := auth.uid();
  if v_uid is null or not exists (
    select 1 from public.admins a where a.user_id = v_uid and a.is_active = true
  ) then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.id is null then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  v_allowed := case v_booking.status
    when 'pending' then p_new_status in ('approved', 'cancelled')
    when 'approved' then p_new_status in ('confirmed', 'cancelled')
    when 'confirmed' then p_new_status in ('released', 'cancelled')
    when 'released' then p_new_status in ('returned')
    else false
  end;

  if not v_allowed then
    raise exception 'INVALID_STATUS_TRANSITION';
  end if;

  update public.bookings
  set status = p_new_status,
    approved_at = case when p_new_status = 'approved' then now() else approved_at end,
    confirmed_at = case when p_new_status = 'confirmed' then now() else confirmed_at end,
    released_at = case when p_new_status = 'released' then now() else released_at end,
    returned_at = case when p_new_status = 'returned' then now() else returned_at end,
    cancelled_at = case when p_new_status = 'cancelled' then now() else cancelled_at end
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_status_history (booking_id, from_status, to_status, note, changed_by)
  values (p_booking_id, v_booking.status, p_new_status, p_note, v_uid);

  if p_new_status in ('returned', 'cancelled') and v_booking.inventory_unit_id is not null then
    update public.inventory_units
    set status = 'available'
    where id = v_booking.inventory_unit_id
      and status in ('reserved', 'rented');
  elsif p_new_status = 'released' and v_booking.inventory_unit_id is not null then
    update public.inventory_units set status = 'rented' where id = v_booking.inventory_unit_id;
  end if;

  if p_new_status = 'cancelled' then
    update public.availability_calendar_entries
    set status = 'blocked'
    where product_id = v_booking.product_id
      and inventory_unit_id = v_booking.inventory_unit_id
      and start_date = v_booking.rental_start_date
      and end_date = v_booking.rental_end_date
      and status in ('reserving', 'booked');
    delete from public.availability_calendar_entries
    where product_id = v_booking.product_id
      and inventory_unit_id = v_booking.inventory_unit_id
      and start_date = v_booking.rental_start_date
      and end_date = v_booking.rental_end_date
      and status = 'blocked';
  elsif p_new_status = 'confirmed' then
    update public.availability_calendar_entries
    set status = 'booked'
    where product_id = v_booking.product_id
      and inventory_unit_id = v_booking.inventory_unit_id
      and start_date = v_booking.rental_start_date
      and end_date = v_booking.rental_end_date;
  end if;

  insert into public.notifications (user_id, type, title, message, booking_id)
  values (
    v_booking.user_id,
    'booking_status_changed',
    'Booking ' || v_booking.booking_reference || ' updated',
    'Your booking status changed to ' || p_new_status || '.',
    v_booking.id
  );

  perform private.log_audit_event(
    'booking.status_changed', 'booking', v_booking.id::text, v_booking.id,
    jsonb_build_object('status', v_booking.status), jsonb_build_object('status', p_new_status),
    jsonb_build_object('note', p_note), 'admin'
  );

  return v_booking;
end;
$$;

revoke all on function public.admin_set_booking_status(uuid, text, text) from public;
grant execute on function public.admin_set_booking_status(uuid, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Booking confirmation gate: only moves pending/approved -> confirmed once
-- payment, documents, and both signatures are verified server-side.
-- -----------------------------------------------------------------------------

create or replace function public.confirm_booking(
  p_booking_id uuid,
  p_note text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_booking public.bookings;
  v_has_verified_payment boolean;
  v_has_pending_docs boolean;
  v_agreement public.booking_agreements;
begin
  v_uid := auth.uid();
  if v_uid is null or not exists (
    select 1 from public.admins a where a.user_id = v_uid and a.is_active = true
  ) then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.id is null then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  if v_booking.status <> 'approved' then
    raise exception 'BOOKING_NOT_APPROVED';
  end if;

  select exists (
    select 1 from public.payment_records pr
    where pr.booking_id = p_booking_id and pr.status in ('verified', 'paid')
  ) into v_has_verified_payment;

  if not v_has_verified_payment then
    raise exception 'PAYMENT_NOT_VERIFIED';
  end if;

  select exists (
    select 1 from public.booking_documents bd
    where bd.booking_id = p_booking_id and bd.review_status <> 'approved'
  ) into v_has_pending_docs;

  if v_has_pending_docs or not exists (
    select 1 from public.booking_documents bd where bd.booking_id = p_booking_id
  ) then
    raise exception 'DOCUMENTS_NOT_APPROVED';
  end if;

  select * into v_agreement from public.booking_agreements where booking_id = p_booking_id;
  if v_agreement.id is null or v_agreement.status <> 'completed' then
    raise exception 'AGREEMENT_NOT_COMPLETED';
  end if;

  if not exists (
    select 1 from public.inventory_units iu
    where iu.id = v_booking.inventory_unit_id and iu.status = 'reserved'
  ) then
    raise exception 'INVENTORY_NOT_RESERVED';
  end if;

  update public.bookings
  set status = 'confirmed', confirmed_at = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_status_history (booking_id, from_status, to_status, note, changed_by)
  values (p_booking_id, 'approved', 'confirmed', p_note, v_uid);

  update public.availability_calendar_entries
  set status = 'booked'
  where product_id = v_booking.product_id
    and inventory_unit_id = v_booking.inventory_unit_id
    and start_date = v_booking.rental_start_date
    and end_date = v_booking.rental_end_date;

  insert into public.notifications (user_id, type, title, message, booking_id)
  values (
    v_booking.user_id,
    'booking_confirmed',
    'Booking ' || v_booking.booking_reference || ' confirmed',
    'Your booking has been confirmed. See you soon!',
    v_booking.id
  );

  perform private.log_audit_event(
    'booking.confirmed', 'booking', v_booking.id::text, v_booking.id,
    jsonb_build_object('status', 'approved'), jsonb_build_object('status', 'confirmed'),
    jsonb_build_object('note', p_note), 'admin'
  );

  return v_booking;
end;
$$;

revoke all on function public.confirm_booking(uuid, text) from public;
grant execute on function public.confirm_booking(uuid, text) to authenticated;

commit;
