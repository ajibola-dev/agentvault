import { Pool } from "pg";
import type { Task } from "@/lib/task-store";

type TaskRow = {
  id: string;
  title: string;
  description: string;
  reward: string;
  min_rep: number;
  creator_address: string;
  agent_id: string | null;
  agent_address: string | null;
  status: Task["status"];
  escrow_address: string | null;
  escrow_id: string | null;
  escrow_status: Task["escrowStatus"];
  ciphertext: string;
  created_at: string;
  assigned_at: string | null;
};

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;
const inMemoryTasks = new Map<string, Task>();

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    reward: row.reward,
    minRep: row.min_rep,
    creatorAddress: row.creator_address,
    agentId: row.agent_id,
    agentAddress: row.agent_address,
    status: row.status,
    escrowAddress: row.escrow_address,
    escrowId: row.escrow_id,
    escrowStatus: row.escrow_status,
    ciphertext: row.ciphertext,
    createdAt: row.created_at,
    assignedAt: row.assigned_at ?? undefined,
  };
}

function shouldUseInMemoryStore(): boolean {
  return process.env.NODE_ENV === "test";
}

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) {
    throw new Error("DATABASE_URL (or POSTGRES_URL) is required for task persistence");
  }
  return url;
}

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: getDatabaseUrl(),
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

async function ensureSchema(): Promise<void> {
  if (shouldUseInMemoryStore()) {
    return;
  }
  if (!schemaReady) {
    schemaReady = (async () => {
      const client = await getPool().connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            reward TEXT NOT NULL,
            min_rep INTEGER NOT NULL,
            creator_address TEXT NOT NULL,
            agent_id TEXT,
            agent_address TEXT,
            status TEXT NOT NULL CHECK (status IN ('open', 'assigned', 'in_progress', 'completed', 'paid')),
            escrow_address TEXT,
            escrow_id TEXT,
            escrow_status TEXT NOT NULL CHECK (escrow_status IN ('wallet_created', 'pending')),
            ciphertext TEXT NOT NULL,
            created_at TEXT NOT NULL,
            assigned_at TEXT
          )
        `);
      } finally {
        client.release();
      }
    })();
  }
  await schemaReady;
}

export async function createTask(task: Task): Promise<Task> {
  if (shouldUseInMemoryStore()) {
    inMemoryTasks.set(task.id, { ...task, agentAddress: task.agentAddress ?? null });
    return task;
  }

  await ensureSchema();
  await getPool().query(
    `
      INSERT INTO tasks (
        id, title, description, reward, min_rep, creator_address, agent_id, agent_address, status,
        escrow_address, escrow_id, escrow_status, ciphertext, created_at, assigned_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15
      )
    `,
    [
      task.id,
      task.title,
      task.description,
      task.reward,
      task.minRep,
      task.creatorAddress,
      task.agentId,
      task.agentAddress ?? null,
      task.status,
      task.escrowAddress,
      task.escrowId,
      task.escrowStatus,
      task.ciphertext,
      task.createdAt,
      task.assignedAt ?? null,
    ]
  );
  return task;
}

export async function listTasks(): Promise<Task[]> {
  if (shouldUseInMemoryStore()) {
    return [...inMemoryTasks.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  await ensureSchema();
  const result = await getPool().query<TaskRow>(`
    SELECT
      id, title, description, reward, min_rep, creator_address, agent_id, agent_address, status,
      escrow_address, escrow_id, escrow_status, ciphertext, created_at, assigned_at
    FROM tasks
    ORDER BY created_at DESC
  `);
  return result.rows.map(rowToTask);
}

export async function getTaskById(id: string): Promise<Task | null> {
  if (shouldUseInMemoryStore()) {
    return inMemoryTasks.get(id) ?? null;
  }

  await ensureSchema();
  const result = await getPool().query<TaskRow>(
    `
      SELECT
        id, title, description, reward, min_rep, creator_address, agent_id, agent_address, status,
        escrow_address, escrow_id, escrow_status, ciphertext, created_at, assigned_at
      FROM tasks
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );
  return result.rows[0] ? rowToTask(result.rows[0]) : null;
}

export async function assignTask(params: {
  id: string;
  agentId: string;
  agentAddress: string | null;
  assignedAt: string;
}): Promise<Task | null> {
  if (shouldUseInMemoryStore()) {
    const existing = inMemoryTasks.get(params.id);
    if (!existing) {
      return null;
    }
    const updated: Task = {
      ...existing,
      agentId: params.agentId,
      agentAddress: params.agentAddress,
      status: "assigned",
      assignedAt: params.assignedAt,
    };
    inMemoryTasks.set(params.id, updated);
    return updated;
  }

  await ensureSchema();
  await getPool().query(
    `
      UPDATE tasks
      SET agent_id = $1, agent_address = $2, status = 'assigned', assigned_at = $3
      WHERE id = $4
    `,
    [params.agentId, params.agentAddress, params.assignedAt, params.id]
  );
  return getTaskById(params.id);
}

export async function updateTaskStatus(id: string, status: Task["status"]): Promise<Task | null> {
  if (shouldUseInMemoryStore()) {
    const existing = inMemoryTasks.get(id);
    if (!existing) {
      return null;
    }
    const updated = { ...existing, status };
    inMemoryTasks.set(id, updated);
    return updated;
  }

  await ensureSchema();
  await getPool().query("UPDATE tasks SET status = $1 WHERE id = $2", [status, id]);
  return getTaskById(id);
}

export async function clearTasks(): Promise<void> {
  if (shouldUseInMemoryStore()) {
    inMemoryTasks.clear();
    return;
  }

  await ensureSchema();
  await getPool().query("DELETE FROM tasks");
}
