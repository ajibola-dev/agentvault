import db from "@/lib/db";
import type { Task } from "@/lib/task-store";

type TaskRow = {
  id: string;
  title: string;
  description: string;
  reward: string;
  minRep: number;
  creatorAddress: string;
  agentId: string | null;
  agentAddress: string | null;
  status: "open" | "assigned" | "in_progress" | "completed" | "paid";
  escrowAddress: string | null;
  escrowId: string | null;
  escrowStatus: "wallet_created" | "pending";
  ciphertext: string;
  createdAt: string;
  assignedAt: string | null;
};

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    reward: row.reward,
    minRep: row.minRep,
    creatorAddress: row.creatorAddress,
    agentId: row.agentId,
    agentAddress: row.agentAddress,
    status: row.status,
    escrowAddress: row.escrowAddress,
    escrowId: row.escrowId,
    escrowStatus: row.escrowStatus,
    ciphertext: row.ciphertext,
    createdAt: row.createdAt,
    assignedAt: row.assignedAt ?? undefined,
  };
}

const insertTaskStmt = db.prepare(`
  INSERT INTO tasks (
    id, title, description, reward, minRep, creatorAddress, agentId, agentAddress, status,
    escrowAddress, escrowId, escrowStatus, ciphertext, createdAt, assignedAt
  ) VALUES (
    @id, @title, @description, @reward, @minRep, @creatorAddress, @agentId, @agentAddress, @status,
    @escrowAddress, @escrowId, @escrowStatus, @ciphertext, @createdAt, @assignedAt
  )
`);

const listTasksStmt = db.prepare(`
  SELECT
    id, title, description, reward, minRep, creatorAddress, agentId, agentAddress, status,
    escrowAddress, escrowId, escrowStatus, ciphertext, createdAt, assignedAt
  FROM tasks
  ORDER BY createdAt DESC
`);

const getTaskByIdStmt = db.prepare(`
  SELECT
    id, title, description, reward, minRep, creatorAddress, agentId, agentAddress, status,
    escrowAddress, escrowId, escrowStatus, ciphertext, createdAt, assignedAt
  FROM tasks
  WHERE id = ?
  LIMIT 1
`);

const assignTaskStmt = db.prepare(`
  UPDATE tasks
  SET
    agentId = @agentId,
    agentAddress = @agentAddress,
    status = 'assigned',
    assignedAt = @assignedAt
  WHERE id = @id
`);

const updateTaskStatusStmt = db.prepare(`
  UPDATE tasks
  SET status = @status
  WHERE id = @id
`);

export function createTask(task: Task): Task {
  insertTaskStmt.run({
    ...task,
    assignedAt: task.assignedAt ?? null,
    agentAddress: task.agentAddress ?? null,
  });
  return task;
}

export function listTasks(): Task[] {
  const rows = listTasksStmt.all() as TaskRow[];
  return rows.map(rowToTask);
}

export function getTaskById(id: string): Task | null {
  const row = getTaskByIdStmt.get(id) as TaskRow | undefined;
  if (!row) {
    return null;
  }
  return rowToTask(row);
}

export function assignTask(params: {
  id: string;
  agentId: string;
  agentAddress: string | null;
  assignedAt: string;
}): Task | null {
  assignTaskStmt.run(params);
  return getTaskById(params.id);
}

export function updateTaskStatus(id: string, status: Task["status"]): Task | null {
  updateTaskStatusStmt.run({ id, status });
  return getTaskById(id);
}
