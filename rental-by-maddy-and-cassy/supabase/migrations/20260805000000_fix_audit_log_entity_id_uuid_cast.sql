-- Maddy & Cassy Rentals - fix audit_logs.entity_id uuid cast
--
-- Context: public.audit_logs.entity_id is a uuid column (see
-- 20260802000000_paymongo_audit_push_agreement_versions.sql), but
-- private.log_audit_event(p_entity_id text, ...) inserted p_entity_id
-- straight into that column with no cast. Postgres has no implicit or
-- assignment cast from text to uuid, so this raised
-- "column entity_id is of type uuid but expression is of type text" on
-- EVERY call with a non-null entity_id -- not only malformed ones. That
-- broke create_booking() (called before any payment step, so the entire
-- reservation -> payment flow was blocked at the first RPC), plus
-- confirm_booking, cancel_own_booking, admin_set_booking_status,
-- system_confirm_booking, and both PayMongo audit calls (checkout
-- creation in app/api/payments/checkout/route.ts and payment
-- verification in src/lib/server/paymentFulfillment.ts).
--
-- Fix: validate + explicitly cast p_entity_id to uuid inside
-- log_audit_event instead of relying on an implicit cast that doesn't
-- exist. The audit_logs.entity_id column stays uuid -- it is not
-- reverted to text. A genuinely non-UUID entity_id (e.g. a booking
-- reference/label instead of a booking id) now fails fast with a clear
-- INVALID_ENTITY_ID error instead of the previous cryptic message.
--
-- This migration was applied directly against the live project via the
-- Supabase MCP tools (mirrored here for migration history).

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'audit_logs'
      and column_name = 'entity_id' and data_type = 'text'
  ) then
    alter table public.audit_logs
      alter column entity_id type uuid using nullif(entity_id, '')::uuid;
  end if;
end $$;

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
  v_entity_id uuid;
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

  if p_entity_id is not null and p_entity_id <> '' then
    begin
      v_entity_id := p_entity_id::uuid;
    exception when invalid_text_representation then
      raise exception 'INVALID_ENTITY_ID: % is not a valid UUID', p_entity_id
        using errcode = '22P02';
    end;
  end if;

  insert into public.audit_logs (
    actor_user_id, actor_type, action, entity_type, entity_id,
    booking_id, previous_values, new_values, metadata
  )
  values (
    v_uid, v_actor_type, p_action, p_entity_type, v_entity_id,
    p_booking_id, p_previous_values, p_new_values, coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;
