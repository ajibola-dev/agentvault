export type AuditStatus =
  | "success"
  | "unauthorized"
  | "validation_error"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "error";

type AuditEventInput = {
  endpoint: string;
  action: string;
  actorAddress?: string | null;
  ip?: string | null;
  status: AuditStatus;
  resourceId?: string | null;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
};

type AuditLogRow = {
  id: string;
  endpoint: string;
  action: string;
  actorAddress: string | null;
  ip: string | null;
  status: AuditStatus;
  resourceId: string | null;
  message: string | null;
  metadata: string | null;
  createdAt: string;
};

const auditLogs: AuditLogRow[] = [];

export function logAuditEvent(event: AuditEventInput): void {
  auditLogs.unshift({
    id: crypto.randomUUID(),
    endpoint: event.endpoint,
    action: event.action,
    actorAddress: event.actorAddress ?? null,
    ip: event.ip ?? null,
    status: event.status,
    resourceId: event.resourceId ?? null,
    message: event.message ?? null,
    metadata: event.metadata ? JSON.stringify(event.metadata) : null,
    createdAt: new Date().toISOString(),
  });
}

export function clearAuditLogs(): void {
  auditLogs.length = 0;
}

export function listAuditLogs(limit = 100): Array<AuditLogRow & { parsedMetadata: Record<string, unknown> | null }> {
  return auditLogs.slice(0, limit).map((row) => ({
    ...row,
    parsedMetadata: row.metadata ? JSON.parse(row.metadata) as Record<string, unknown> : null,
  }));
}
