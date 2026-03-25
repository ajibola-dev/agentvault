import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const dataDir = path.join(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "agentvault.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

function createTasksTable(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      reward TEXT NOT NULL,
      minRep INTEGER NOT NULL,
      creatorAddress TEXT NOT NULL,
      agentId TEXT,
      agentAddress TEXT,
      status TEXT NOT NULL CHECK (status IN ('open', 'assigned', 'in_progress', 'completed', 'paid')),
      escrowAddress TEXT,
      escrowId TEXT,
      escrowStatus TEXT NOT NULL CHECK (escrowStatus IN ('wallet_created', 'pending')),
      ciphertext TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      assignedAt TEXT
    )
  `);
}

function createAuthTables(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_nonces (
      nonce TEXT PRIMARY KEY,
      address TEXT NOT NULL,
      expiresAt INTEGER NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token TEXT PRIMARY KEY,
      address TEXT NOT NULL,
      expiresAt INTEGER NOT NULL
    )
  `);
}

function migrateToV2(): void {
  const table = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'tasks'")
    .get() as { name: string } | undefined;

  if (!table) {
    createTasksTable();
    return;
  }

  db.exec("ALTER TABLE tasks RENAME TO tasks_old");
  createTasksTable();
  db.exec(`
    INSERT INTO tasks (
      id, title, description, reward, minRep, creatorAddress, agentId, agentAddress,
      status, escrowAddress, escrowId, escrowStatus, ciphertext, createdAt, assignedAt
    )
    SELECT
      id, title, description, reward, minRep, creatorAddress, agentId, agentAddress,
      status, escrowAddress, escrowId, escrowStatus, ciphertext, createdAt, assignedAt
    FROM tasks_old
  `);
  db.exec("DROP TABLE tasks_old");
}

const schemaVersion = Number(db.pragma("user_version", { simple: true }));

if (schemaVersion < 1) {
  createTasksTable();
  db.pragma("user_version = 1");
}

if (schemaVersion < 2) {
  migrateToV2();
  db.pragma("user_version = 2");
}

if (schemaVersion < 3) {
  createAuthTables();
  db.pragma("user_version = 3");
}

export default db;
