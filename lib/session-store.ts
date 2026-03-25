import db from "@/lib/db";

const NONCE_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function now(): number {
  return Date.now();
}

const insertNonceStmt = db.prepare(`
  INSERT INTO auth_nonces (nonce, address, expiresAt)
  VALUES (@nonce, @address, @expiresAt)
`);

const getNonceStmt = db.prepare(`
  SELECT address, expiresAt
  FROM auth_nonces
  WHERE nonce = ?
  LIMIT 1
`);

const deleteNonceStmt = db.prepare("DELETE FROM auth_nonces WHERE nonce = ?");
const deleteExpiredNoncesStmt = db.prepare("DELETE FROM auth_nonces WHERE expiresAt < ?");

const insertSessionStmt = db.prepare(`
  INSERT INTO auth_sessions (token, address, expiresAt)
  VALUES (@token, @address, @expiresAt)
`);

const getSessionStmt = db.prepare(`
  SELECT address, expiresAt
  FROM auth_sessions
  WHERE token = ?
  LIMIT 1
`);

const deleteSessionStmt = db.prepare("DELETE FROM auth_sessions WHERE token = ?");
const deleteExpiredSessionsStmt = db.prepare("DELETE FROM auth_sessions WHERE expiresAt < ?");

export function issueNonce(address: string): string {
  const nonce = crypto.randomUUID();
  insertNonceStmt.run({
    nonce,
    address,
    expiresAt: now() + NONCE_TTL_MS,
  });
  return nonce;
}

export function hasNonce(address: string, nonce: string): boolean {
  deleteExpiredNoncesStmt.run(now());
  const row = getNonceStmt.get(nonce) as { address: string; expiresAt: number } | undefined;
  if (!row) {
    return false;
  }
  return row.address.toLowerCase() === address.toLowerCase();
}

export function consumeNonce(address: string, nonce: string): boolean {
  if (!hasNonce(address, nonce)) {
    return false;
  }
  deleteNonceStmt.run(nonce);
  return true;
}

export function createSession(address: string): string {
  const token = crypto.randomUUID();
  insertSessionStmt.run({
    token,
    address,
    expiresAt: now() + SESSION_TTL_MS,
  });
  return token;
}

export function getSessionAddress(token: string): string | null {
  deleteExpiredSessionsStmt.run(now());
  const row = getSessionStmt.get(token) as { address: string; expiresAt: number } | undefined;
  if (!row) {
    return null;
  }
  return row.address;
}

export function invalidateSession(token: string): void {
  deleteSessionStmt.run(token);
}

export function clearAuthState(): void {
  db.exec("DELETE FROM auth_nonces; DELETE FROM auth_sessions;");
}
