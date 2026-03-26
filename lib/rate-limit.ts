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

const counters = new Map<string, number>();

function now(): number {
  return Date.now();
}

function makeBucketKey(endpoint: string, key: string, windowStart: number): string {
  return `${endpoint}|${key}|${windowStart}`;
}

export function checkRateLimit(params: RateLimitParams): RateLimitResult {
  const ts = now();
  const windowStart = Math.floor(ts / params.windowMs) * params.windowMs;
  const minWindowStart = windowStart - params.windowMs * 2;

  for (const bucketKey of counters.keys()) {
    const parts = bucketKey.split("|");
    const bucketWindowStart = Number(parts[parts.length - 1]);
    if (Number.isFinite(bucketWindowStart) && bucketWindowStart < minWindowStart) {
      counters.delete(bucketKey);
    }
  }

  const bucketKey = makeBucketKey(params.endpoint, params.key, windowStart);
  const nextCount = (counters.get(bucketKey) ?? 0) + 1;
  counters.set(bucketKey, nextCount);

  const remaining = Math.max(0, params.max - nextCount);
  const retryAfterSeconds = Math.max(1, Math.ceil((windowStart + params.windowMs - ts) / 1000));

  return {
    allowed: nextCount <= params.max,
    remaining,
    retryAfterSeconds,
  };
}

export function clearRateLimits(): void {
  counters.clear();
}
