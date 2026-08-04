import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/src/lib/supabase/database.types";
import type { PaymentEventLog, PayMongoWebhookEvent, PaymentRecord } from "@/src/types/payment";
import type { AuditLogEntry } from "@/src/types/admin";

function mapPayment(row: Tables<"payment_records">): PaymentRecord {
  return {
    id: row.id,
    bookingId: row.booking_id,
    userId: row.user_id,
    paymentKind: row.payment_kind,
    amount: row.amount,
    currency: "PHP",
    status: row.status as PaymentRecord["status"],
    paymentType: row.payment_type as PaymentRecord["paymentType"],
    paymentMethod: row.payment_method ?? undefined,
    externalReference: row.external_reference ?? undefined,
    paymongoPaymentId: row.paymongo_payment_id ?? undefined,
    paymongoCheckoutSessionId: row.paymongo_checkout_session_id ?? undefined,
    failureCode: row.failure_code ?? undefined,
    failureMessage: row.failure_message ?? undefined,
    refundStatus: row.refund_status as PaymentRecord["refundStatus"],
    refundAmount: row.refund_amount,
    submittedAt: row.submitted_at,
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Admin-only (RLS payments_admin_manage grants a full read to active admins). */
export async function getAllPaymentRecords(supabase: SupabaseClient<Database>): Promise<PaymentRecord[]> {
  const { data, error } = await supabase
    .from("payment_records")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapPayment);
}

export async function getPaymentEvents(supabase: SupabaseClient<Database>): Promise<PayMongoWebhookEvent[]> {
  const { data, error } = await supabase
    .from("paymongo_webhook_events")
    .select("*")
    .order("received_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []).map(
    (row): PayMongoWebhookEvent => ({
      id: row.id,
      providerEventId: row.provider_event_id,
      eventType: row.event_type,
      payload: row.payload as Record<string, unknown>,
      signatureValid: row.signature_valid,
      processingStatus: row.processing_status as PayMongoWebhookEvent["processingStatus"],
      errorMessage: row.error_message ?? undefined,
      paymentRecordId: row.payment_record_id ?? undefined,
      receivedAt: row.received_at,
      processedAt: row.processed_at ?? undefined,
    }),
  );
}

export async function getAdminPaymentEventLogs(supabase: SupabaseClient<Database>): Promise<PaymentEventLog[]> {
  const { data, error } = await supabase
    .from("payment_event_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []).map(
    (row): PaymentEventLog => ({
      id: row.id,
      paymentRecordId: row.payment_record_id,
      eventType: row.event_type,
      fromStatus: row.from_status ?? undefined,
      toStatus: row.to_status ?? undefined,
      details: row.details as Record<string, unknown>,
      actorUserId: row.actor_user_id ?? undefined,
      providerEventId: row.provider_event_id ?? undefined,
      isManualCorrection: row.is_manual_correction,
      createdAt: row.created_at,
    }),
  );
}

export async function getAuditLogs(supabase: SupabaseClient<Database>): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []).map(
    (row): AuditLogEntry => ({
      id: row.id,
      actorUserId: row.actor_user_id ?? undefined,
      actorType: row.actor_type as AuditLogEntry["actorType"],
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id ?? undefined,
      bookingId: row.booking_id ?? undefined,
      previousValues: (row.previous_values as Record<string, unknown>) ?? undefined,
      newValues: (row.new_values as Record<string, unknown>) ?? undefined,
      metadata: row.metadata as Record<string, unknown>,
      ipAddress: row.ip_address ? String(row.ip_address) : undefined,
      userAgent: row.user_agent ?? undefined,
      createdAt: row.created_at,
    }),
  );
}
