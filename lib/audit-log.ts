import db from "@/lib/db";

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

const insertStmt = db.prepare(`
  INSERT INTO audit_logs (
    id, endpoint, action, actorAddress, ip, status, resourceId, message, metadata, createdAt
  ) VALUES (
    @id, @endpoint, @action, @actorAddress, @ip, @status, @resourceId, @message, @metadata, @createdAt
  )
`);
const listStmt = db.prepare(`
  SELECT id, endpoint, action, actorAddress, ip, status, resourceId, message, metadata, createdAt
  FROM audit_logs
  ORDER BY createdAt DESC
  LIMIT ?
`);

export function logAuditEvent(event: AuditEventInput): void {
  insertStmt.run({
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
  db.exec("DELETE FROM audit_logs");
}

export function listAuditLogs(limit = 100): Array<AuditLogRow & { parsedMetadata: Record<string, unknown> | null }> {
  const rows = listStmt.all(limit) as AuditLogRow[];
  return rows.map((row) => ({
    ...row,
    parsedMetadata: row.metadata ? JSON.parse(row.metadata) as Record<string, unknown> : null,
  }));
}
