CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL UNIQUE,
  name TEXT,
  tags TEXT[],
  emoji TEXT,
  reputation INTEGER DEFAULT 1,
  created_at TEXT NOT NULL
);
