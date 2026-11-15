import "server-only";

export type AdminAuditAction =
  | "organisation.created"
  | "organisation.updated"
  | "organisation.contacts_updated"
  | "user.invited"
  | "user.profile_status_changed"
  | "user.membership_changed"
  | "user.platform_role_changed"
  | "user.password_reset_requested";

export type PreparedAdminAuditEvent = {
  action: AdminAuditAction;
  actorId: string;
  entityId: string;
  occurredAt: string;
};

export function prepareAdminAuditEvent(
  action: AdminAuditAction,
  actorId: string,
  entityId: string,
): PreparedAdminAuditEvent {
  return {
    action,
    actorId,
    entityId,
    occurredAt: new Date().toISOString(),
  };
}
