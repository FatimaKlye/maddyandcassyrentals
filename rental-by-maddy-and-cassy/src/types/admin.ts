/**
 * There is no more public.admins table — authorization is granted by a
 * public.user_roles row with role = 'admin', enforced by private.is_admin()
 * (see private.is_active_admin() in RLS policies and requireActiveAdmin()
 * server-side). This shape is assembled by joining user_roles with profiles
 * (for account_status) — never written by client code directly; only through
 * app/api/admin/users routes guarded by requireActiveAdmin().
 */
export interface Admin {
  userId: string;
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
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
