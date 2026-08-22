/**
 * Ad-hoc in-memory rate limiter.
 *
 * There is no shared rate-limiting primitive on this stack and no database
 * table backing this, so the counters live in the server instance's memory:
 * they reset on deploy and are not shared across instances. That is enough to
 * stop a single client hammering the expensive endpoints (resume upload +
 * LLM screening), not a distributed abuse guarantee.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const RULES = {
  apply: { limit: 5, windowMs: 10 * 60 * 1000 },
  screen: { limit: 20, windowMs: 10 * 60 * 1000 },
} as const;

export type RateLimitAction = keyof typeof RULES;

/** Best-effort caller identity from proxy headers. */
export function callerFingerprint(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return (
    request.headers.get("cf-connecting-ip") ??
    (forwarded ? (forwarded.split(",")[0]?.trim() ?? "unknown") : null) ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export function checkRateLimit(action: RateLimitAction, fingerprint: string) {
  const rule = RULES[action];
  const key = `${action}:${fingerprint}`;
  const now = Date.now();

  // Opportunistic cleanup so the map cannot grow unbounded.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  }

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
    return { allowed: true as const };
  }

  if (existing.count >= rule.limit) {
    return {
      allowed: false as const,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true as const };
}

export function rateLimitMessage(action: RateLimitAction, retryAfterSeconds: number) {
  const minutes = Math.ceil(retryAfterSeconds / 60);
  const wait = minutes <= 1 ? "a minute" : `${minutes} minutes`;
  return action === "apply"
    ? `Too many submissions from this connection. Try again in about ${wait}.`
    : `Too many screening runs from this connection. Try again in about ${wait}.`;
}
