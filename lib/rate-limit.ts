import db from "@/lib/db";

type RateLimitParams = {
  endpoint: string;
  key: string;
  max: number;
  windowMs: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

const upsertStmt = db.prepare(`
  INSERT INTO rate_limits (endpoint, key, windowStart, count)
  VALUES (@endpoint, @key, @windowStart, 1)
  ON CONFLICT(endpoint, key, windowStart)
  DO UPDATE SET count = count + 1
`);

const readStmt = db.prepare(`
  SELECT count
  FROM rate_limits
  WHERE endpoint = @endpoint AND key = @key AND windowStart = @windowStart
`);

const clearExpiredStmt = db.prepare(`
  DELETE FROM rate_limits
  WHERE windowStart < @minWindowStart
`);

function now(): number {
  return Date.now();
}

export function checkRateLimit(params: RateLimitParams): RateLimitResult {
  const ts = now();
  const windowStart = Math.floor(ts / params.windowMs) * params.windowMs;
  const minWindowStart = windowStart - params.windowMs * 2;

  clearExpiredStmt.run({ minWindowStart });

  upsertStmt.run({
    endpoint: params.endpoint,
    key: params.key,
    windowStart,
  });

  const row = readStmt.get({
    endpoint: params.endpoint,
    key: params.key,
    windowStart,
  }) as { count: number } | undefined;

  const count = row?.count ?? 0;
  const remaining = Math.max(0, params.max - count);
  const retryAfterSeconds = Math.max(1, Math.ceil((windowStart + params.windowMs - ts) / 1000));

  return {
    allowed: count <= params.max,
    remaining,
    retryAfterSeconds,
  };
}

export function clearRateLimits(): void {
  db.exec("DELETE FROM rate_limits");
}
