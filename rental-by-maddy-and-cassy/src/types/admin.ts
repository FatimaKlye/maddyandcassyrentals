/**
 * public.admins — authoritative source of truth for admin authorization,
 * enforced by private.is_active_admin() in RLS policies. Never written by
 * client code directly; only through app/api/admin/users routes guarded by
 * requireActiveAdmin().
 */
export interface Admin {
  userId: string;
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorUserId?: string;
  actorType: "user" | "admin" | "system" | "service";
  action: string;
  entityType: string;
  entityId?: string;
  bookingId?: string;
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  metadata: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}
