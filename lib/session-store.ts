const NONCE_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

type NonceRecord = {
  address: string;
  expiresAt: number;
};

type SessionRecord = {
  address: string;
  expiresAt: number;
};

const nonces = new Map<string, NonceRecord>();
const sessions = new Map<string, SessionRecord>();

function now(): number {
  return Date.now();
}

export function issueNonce(address: string): string {
  const nonce = crypto.randomUUID();
  nonces.set(nonce, { address, expiresAt: now() + NONCE_TTL_MS });
  return nonce;
}

export function hasNonce(address: string, nonce: string): boolean {
  const record = nonces.get(nonce);
  if (!record) {
    return false;
  }
  if (record.expiresAt < now()) {
    nonces.delete(nonce);
    return false;
  }
  return record.address.toLowerCase() === address.toLowerCase();
}

export function consumeNonce(address: string, nonce: string): boolean {
  if (!hasNonce(address, nonce)) {
    return false;
  }
  nonces.delete(nonce);
  return true;
}

export function createSession(address: string): string {
  const token = crypto.randomUUID();
  sessions.set(token, { address, expiresAt: now() + SESSION_TTL_MS });
  return token;
}

export function getSessionAddress(token: string): string | null {
  const record = sessions.get(token);
  if (!record) {
    return null;
  }
  if (record.expiresAt < now()) {
    sessions.delete(token);
    return null;
  }
  return record.address;
}

export function invalidateSession(token: string): void {
  sessions.delete(token);
}
