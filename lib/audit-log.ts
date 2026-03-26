import { getPool, markInMemoryFallback, shouldUseInMemoryStore } from "@/lib/persistence";

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
let schemaReady: Promise<void> | null = null;

async function ensureSchema(): Promise<void> {
  if (shouldUseInMemoryStore()) {
    return;
  }
  if (!schemaReady) {
    schemaReady = (async () => {
      const client = await getPool().connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            endpoint TEXT NOT NULL,
            action TEXT NOT NULL,
            actor_address TEXT,
            ip TEXT,
            status TEXT NOT NULL,
            resource_id TEXT,
            message TEXT,
            metadata TEXT,
            created_at TEXT NOT NULL
          )
        `);
      } finally {
        client.release();
      }
    })();
  }
  await schemaReady;
}

export function logAuditEvent(event: AuditEventInput): void {
  const row: AuditLogRow = {
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
  };
  auditLogs.unshift(row);

  if (shouldUseInMemoryStore()) {
    return;
  }
  void (async () => {
    try {
      await ensureSchema();
      await getPool().query(
        `
          INSERT INTO audit_logs (
            id, endpoint, action, actor_address, ip, status, resource_id, message, metadata, created_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        `,
        [
          row.id,
          row.endpoint,
          row.action,
          row.actorAddress,
          row.ip,
          row.status,
          row.resourceId,
          row.message,
          row.metadata,
          row.createdAt,
        ]
      );
    } catch (error) {
      markInMemoryFallback(error);
    }
  })();
}

export function clearAuditLogs(): void {
  auditLogs.length = 0;
  if (shouldUseInMemoryStore()) {
    return;
  }
  void (async () => {
    try {
      await ensureSchema();
      await getPool().query("DELETE FROM audit_logs");
    } catch (error) {
      markInMemoryFallback(error);
    }
  })();
}

export function listAuditLogs(limit = 100): Array<AuditLogRow & { parsedMetadata: Record<string, unknown> | null }> {
  return auditLogs.slice(0, limit).map((row) => ({
    ...row,
    parsedMetadata: row.metadata ? JSON.parse(row.metadata) as Record<string, unknown> : null,
  }));
}
