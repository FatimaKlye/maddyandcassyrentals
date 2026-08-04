-- Maddy & Cassy Rentals - normalized-schema RPC repair
--
-- Context: at some point on 2026-08-04 the live database was normalized --
-- the pre-normalization tables from 20260802000000_paymongo_audit_push_agreement_versions.sql
-- (bookings, payment_records, admins, availability_calendar_entries,
-- booking_documents, booking_invoices, invoice_line_items, payment_event_logs,
-- paymongo_webhook_events, product_availability_summary) were moved into a
-- legacy_v1_20260804 schema, and a new, differently-shaped public schema was
-- built (inventory_units.lifecycle_status instead of .status, unit_reservations
-- instead of booking-status-derived holds, booking_items/booking_fulfillments/
-- booking_payment_submissions/booking_requirements/user_roles replacing the
-- old wide bookings row, etc.) -- but the RPC functions and two admin-auth
-- helpers were never updated to match, leaving every booking/payment RPC
-- broken (most visibly: "column iu.status does not exist" on checkout).
--
-- This migration was applied directly against the live project via the
-- Supabase MCP tools in three steps (mirrored here as one file for history):
--   1. Repoint private.is_active_admin()/log_audit_event() at user_roles.
--   2. Add PayMongo-specific columns back onto booking_payment_submissions
--      and recreate public.paymongo_webhook_events (both additive; neither
--      existed anywhere in public post-normalization, but the existing
--      webhook flow depends on them for matching + idempotency).
--   3. Rewrite create_booking / confirm_booking / cancel_own_booking /
--      admin_set_booking_status / system_confirm_booking against the
--      normalized schema. Availability is derived solely from
--      inventory_units.lifecycle_status = 'active' + unit_reservations date
--      -range overlap -- never from any booking-status field.
--
-- Additive only: no existing table, column, or policy is dropped or altered
-- destructively; legacy_v1_20260804 is left untouched.

begin;

-- -----------------------------------------------------------------------------
-- 1. Admin-auth helpers: public.admins -> public.user_roles
-- -----------------------------------------------------------------------------

create or replace function private.is_active_admin()
returns boolean
language sql
stable security definer
set search_path = ''
as $$
  select private.is_admin();
$$;

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
        select 1 from public.user_roles ur where ur.user_id = v_uid and ur.role = 'admin'
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

-- -----------------------------------------------------------------------------
-- 2. PayMongo support columns/tables missing from the normalized schema
-- -----------------------------------------------------------------------------

alter table public.booking_payment_submissions
  add column if not exists paymongo_checkout_session_id text,
  add column if not exists paymongo_payment_id text,
  add column if not exists idempotency_key text,
  add column if not exists provider_metadata jsonb not null default '{}'::jsonb,
  add column if not exists currency_code char(3) not null default 'PHP',
  add column if not exists completed_at timestamptz;

create unique index if not exists booking_payment_submissions_idempotency_key_idx
  on public.booking_payment_submissions(idempotency_key)
  where idempotency_key is not null;

create unique index if not exists booking_payment_submissions_checkout_session_idx
  on public.booking_payment_submissions(paymongo_checkout_session_id)
  where paymongo_checkout_session_id is not null;

create index if not exists booking_payment_submissions_paymongo_payment_idx
  on public.booking_payment_submissions(paymongo_payment_id)
  where paymongo_payment_id is not null;

comment on column public.booking_payment_submissions.paymongo_checkout_session_id is
  'PayMongo checkout session id; the webhook matches inbound events to a submission by this column.';
comment on column public.booking_payment_submissions.provider_metadata is
  'Raw PayMongo checkout/payment metadata (livemode, checkout URL, etc.) captured at checkout-creation time.';

create table if not exists public.paymongo_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  signature_valid boolean not null default false,
  processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processed', 'ignored', 'failed')),
  error_message text,
  payment_record_id uuid references public.booking_payment_submissions(id) on delete set null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

comment on table public.paymongo_webhook_events is
  'Raw PayMongo webhook deliveries. provider_event_id uniqueness gives idempotent processing under retried/duplicate delivery.';
comment on column public.paymongo_webhook_events.payment_record_id is
  'References booking_payment_submissions(id) -- column name kept for continuity with the original schema.';

create index if not exists paymongo_webhook_events_type_idx
  on public.paymongo_webhook_events(event_type, received_at desc);
create index if not exists paymongo_webhook_events_payment_record_idx
  on public.paymongo_webhook_events(payment_record_id);

alter table public.paymongo_webhook_events enable row level security;

drop policy if exists paymongo_webhook_events_admin_read on public.paymongo_webhook_events;
create policy paymongo_webhook_events_admin_read
on public.paymongo_webhook_events for select
to authenticated
using ((select private.is_admin()));

-- No insert/update/delete policy for authenticated/anon: the webhook route
-- writes exclusively with the service_role key, which bypasses RLS.

grant select on public.paymongo_webhook_events to authenticated;
grant all on public.paymongo_webhook_events to service_role;

-- -----------------------------------------------------------------------------
-- 3. Booking RPCs, rewritten against the normalized schema
-- -----------------------------------------------------------------------------

-- Return types changed shape (public.bookings is a different, narrower table
-- now), so each function must be dropped before being recreated.
drop function if exists public.create_booking(
  uuid, date, date, text, text, text, numeric, numeric, jsonb, jsonb, jsonb
);
drop function if exists public.confirm_booking(uuid, text);
drop function if exists public.system_confirm_booking(uuid, text);
drop function if exists public.cancel_own_booking(uuid, text);
drop function if exists public.admin_set_booking_status(uuid, text, text);

-- Server-side booking creation: validates availability and reserves an
-- inventory unit atomically. Rewritten against bookings (header + rental_period)
-- + booking_items (line item) + booking_fulfillments + unit_reservations
-- (per-unit hold). Availability is derived solely from
-- inventory_units.lifecycle_status = 'active' plus unit_reservations for the
-- selected date range -- never from any booking-status field, since bookings
-- no longer carries per-unit state.
create function public.create_booking(
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
  v_item_id uuid;
  v_period daterange;
  v_rental_days integer;
  v_subtotal numeric(12,2);
  v_delivery_fee numeric(12,2);
  v_discount numeric(12,2);
  v_effective_daily_rate numeric(12,2);
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

  v_period := daterange(p_rental_start_date, p_rental_end_date + 1, '[)');
  v_rental_days := (p_rental_end_date - p_rental_start_date) + 1;
  v_subtotal := v_product.daily_rate * v_rental_days;
  v_delivery_fee := case when p_fulfillment_method = 'delivery'
    then greatest(coalesce(p_delivery_fee, 0), 0)
    else 0
  end;
  v_discount := least(greatest(coalesce(p_discount_amount, 0), 0), v_subtotal);
  -- booking_totals derives total_amount purely from booking_items/booking_fulfillments
  -- (no discount column exists anywhere in the normalized schema), so the discount
  -- is baked into the per-day rate snapshot rather than subtracted afterward.
  v_effective_daily_rate := greatest(v_product.daily_rate - (v_discount / v_rental_days), 0);

  -- Lock and claim one conflict-free active inventory unit for this date range.
  select iu.id into v_unit_id
  from public.inventory_units iu
  where iu.product_id = p_product_id
    and iu.lifecycle_status = 'active'
    and not exists (
      select 1 from public.unit_reservations ur
      where ur.inventory_unit_id = iu.id
        and ur.status in ('tentative', 'confirmed', 'in_use')
        and ur.reserved_period && v_period
    )
  order by iu.id
  for update of iu skip locked
  limit 1;

  if v_unit_id is null then
    raise exception 'NO_AVAILABILITY' using errcode = 'P0001';
  end if;

  insert into public.bookings (customer_id, status, rental_period, currency_code, customer_notes)
  values (v_uid, 'pending', v_period, 'PHP', nullif(p_customer_notes, ''))
  returning * into v_booking;

  insert into public.booking_items (
    booking_id, product_id, product_name_snapshot, daily_rate_snapshot,
    deposit_per_unit_snapshot, quantity
  )
  values (
    v_booking.id, p_product_id,
    coalesce(nullif(p_product_snapshot ->> 'name', ''), 'Rental item'),
    v_effective_daily_rate, v_product.refundable_deposit, 1
  )
  returning id into v_item_id;

  insert into public.booking_fulfillments (
    booking_id, method, address_line_1, delivery_fee_snapshot,
    recipient_name, contact_number
  )
  values (
    v_booking.id, p_fulfillment_method::public.fulfillment_method, nullif(p_location, ''),
    v_delivery_fee,
    nullif(p_customer_snapshot ->> 'fullName', ''),
    nullif(p_customer_snapshot ->> 'phone', '')
  );

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

  insert into public.unit_reservations (
    inventory_unit_id, booking_item_id, kind, status, reserved_period, created_by
  )
  values (
    v_unit_id, v_item_id, 'booking', 'tentative', v_period, v_uid
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
  'Client-callable RPC (via supabase.rpc) run as SECURITY DEFINER so it can validate real inventory availability, which customers cannot SELECT directly. Availability comes from inventory_units.lifecycle_status + unit_reservations date-range overlap only.';

-- Booking confirmation gate: only moves approved -> confirmed once a payment
-- submission is verified, every required document is approved/waived, and
-- both agreement signatures are complete.
create function public.confirm_booking(
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
  if v_uid is null or not (select private.is_admin()) then
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
    select 1 from public.booking_payment_submissions bps
    where bps.booking_id = p_booking_id and bps.status = 'verified'
  ) into v_has_verified_payment;

  if not v_has_verified_payment then
    raise exception 'PAYMENT_NOT_VERIFIED';
  end if;

  select exists (
    select 1 from public.booking_requirements br
    where br.booking_id = p_booking_id and br.is_required = true
      and br.status not in ('approved', 'waived')
  ) into v_has_pending_docs;

  if v_has_pending_docs or not exists (
    select 1 from public.booking_requirements br where br.booking_id = p_booking_id
  ) then
    raise exception 'DOCUMENTS_NOT_APPROVED';
  end if;

  select * into v_agreement from public.booking_agreements where booking_id = p_booking_id;
  if v_agreement.id is null or v_agreement.status <> 'completed' then
    raise exception 'AGREEMENT_NOT_COMPLETED';
  end if;

  if not exists (
    select 1
    from public.booking_items bi
    join public.unit_reservations ur on ur.booking_item_id = bi.id
    where bi.booking_id = p_booking_id and ur.status in ('tentative', 'confirmed')
  ) then
    raise exception 'INVENTORY_NOT_RESERVED';
  end if;

  update public.bookings
  set status = 'confirmed', confirmed_at = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_status_history (booking_id, from_status, to_status, note, changed_by)
  values (p_booking_id, 'approved', 'confirmed', p_note, v_uid);

  update public.unit_reservations ur
  set status = 'confirmed'
  where ur.booking_item_id in (select bi.id from public.booking_items bi where bi.booking_id = p_booking_id)
    and ur.status = 'tentative';

  insert into public.notifications (user_id, notification_type, title, message, booking_id)
  values (
    v_booking.customer_id,
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

-- Same gate as confirm_booking, but runs from the service-role-only PayMongo
-- fulfillment path (no admin auth check) and returns quietly instead of
-- raising when a gate isn't clear yet.
create function public.system_confirm_booking(
  p_booking_id uuid,
  p_note text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_has_verified_payment boolean;
  v_has_pending_docs boolean;
  v_agreement public.booking_agreements;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.id is null then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  if v_booking.status <> 'approved' then
    return v_booking;
  end if;

  select exists (
    select 1 from public.booking_payment_submissions bps
    where bps.booking_id = p_booking_id and bps.status = 'verified'
  ) into v_has_verified_payment;
  if not v_has_verified_payment then
    return v_booking;
  end if;

  select exists (
    select 1 from public.booking_requirements br
    where br.booking_id = p_booking_id and br.is_required = true
      and br.status not in ('approved', 'waived')
  ) into v_has_pending_docs;
  if v_has_pending_docs or not exists (
    select 1 from public.booking_requirements br where br.booking_id = p_booking_id
  ) then
    return v_booking;
  end if;

  select * into v_agreement from public.booking_agreements where booking_id = p_booking_id;
  if v_agreement.id is null or v_agreement.status <> 'completed' then
    return v_booking;
  end if;

  if not exists (
    select 1
    from public.booking_items bi
    join public.unit_reservations ur on ur.booking_item_id = bi.id
    where bi.booking_id = p_booking_id and ur.status in ('tentative', 'confirmed')
  ) then
    return v_booking;
  end if;

  update public.bookings
  set status = 'confirmed', confirmed_at = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_status_history (booking_id, from_status, to_status, note, changed_by)
  values (p_booking_id, 'approved', 'confirmed', coalesce(p_note, 'Auto-confirmed after verified payment.'), null);

  update public.unit_reservations ur
  set status = 'confirmed'
  where ur.booking_item_id in (select bi.id from public.booking_items bi where bi.booking_id = p_booking_id)
    and ur.status = 'tentative';

  insert into public.notifications (user_id, notification_type, title, message, booking_id)
  values (
    v_booking.customer_id,
    'booking_confirmed',
    'Booking ' || v_booking.booking_reference || ' confirmed',
    'Your booking has been confirmed. See you soon!',
    v_booking.id
  );

  perform private.log_audit_event(
    'booking.confirmed', 'booking', v_booking.id::text, v_booking.id,
    jsonb_build_object('status', 'approved'), jsonb_build_object('status', 'confirmed'),
    jsonb_build_object('note', p_note), 'system'
  );

  return v_booking;
end;
$$;

revoke all on function public.system_confirm_booking(uuid, text) from public;
grant execute on function public.system_confirm_booking(uuid, text) to service_role;

comment on function public.system_confirm_booking is
  'Service-role-only auto-confirm invoked by the verified PayMongo payment fulfillment path; never callable by authenticated/anon.';

create function public.cancel_own_booking(
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
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.id is null or v_booking.customer_id <> v_uid then
    raise exception 'BOOKING_NOT_FOUND';
  end if;

  if v_booking.status not in ('pending', 'approved') then
    raise exception 'BOOKING_NOT_CANCELLABLE';
  end if;

  update public.bookings
  set status = 'cancelled', cancelled_at = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_status_history (booking_id, from_status, to_status, note, changed_by)
  values (p_booking_id, 'approved', 'cancelled', coalesce(p_note, 'Cancelled by renter.'), v_uid);

  update public.unit_reservations ur
  set status = 'cancelled'
  where ur.booking_item_id in (select bi.id from public.booking_items bi where bi.booking_id = p_booking_id)
    and ur.status in ('tentative', 'confirmed');

  perform private.log_audit_event(
    'booking.cancelled', 'booking', v_booking.id::text, v_booking.id,
    null, jsonb_build_object('status', 'cancelled'), jsonb_build_object('note', p_note), 'user'
  );

  return v_booking;
end;
$$;

revoke all on function public.cancel_own_booking(uuid, text) from public;
grant execute on function public.cancel_own_booking(uuid, text) to authenticated;

-- Admin-only booking status transitions, always paired with history + a
-- unit_reservations status flip and an audit-log entry. Same transition
-- graph as before (pending->approved/cancelled, approved->confirmed/cancelled,
-- confirmed->released/cancelled, released->returned); the normalized schema
-- adds 'draft'/'ready_for_release'/'rejected' to booking_status but this
-- function intentionally keeps the existing transition set unchanged.
create function public.admin_set_booking_status(
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
  if v_uid is null or not (select private.is_admin()) then
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
  set status = p_new_status::public.booking_status,
    approved_at = case when p_new_status = 'approved' then now() else approved_at end,
    confirmed_at = case when p_new_status = 'confirmed' then now() else confirmed_at end,
    released_at = case when p_new_status = 'released' then now() else released_at end,
    returned_at = case when p_new_status = 'returned' then now() else returned_at end,
    cancelled_at = case when p_new_status = 'cancelled' then now() else cancelled_at end
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_status_history (booking_id, from_status, to_status, note, changed_by)
  values (p_booking_id, v_booking.status, p_new_status::public.booking_status, p_note, v_uid);

  if p_new_status in ('returned', 'cancelled') and exists (
    select 1 from public.booking_items bi where bi.booking_id = v_booking.id
  ) then
    update public.unit_reservations ur
    set status = case when p_new_status = 'returned' then 'completed' else 'cancelled' end
    where ur.booking_item_id in (select bi.id from public.booking_items bi where bi.booking_id = v_booking.id)
      and ur.status in ('tentative', 'confirmed', 'in_use');
  elsif p_new_status = 'released' then
    update public.unit_reservations ur
    set status = 'in_use'
    where ur.booking_item_id in (select bi.id from public.booking_items bi where bi.booking_id = v_booking.id)
      and ur.status = 'confirmed';
  end if;

  insert into public.notifications (user_id, notification_type, title, message, booking_id)
  values (
    v_booking.customer_id,
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

commit;
