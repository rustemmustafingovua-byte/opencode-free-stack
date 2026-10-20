/**
 * Rate limiting and quota accounting.
 *
 * Free tiers are enforced two ways:
 *   - RPM  : requests per minute, per account
 *   - pool : a daily token allowance that is consumed as tokens x model weight
 *
 * Both are handled here so a caller never has to think about them.
 */

/** Minimal sliding-window limiter. */
export class RateLimiter {
  /** @param {number} rpm requests per minute (null = unlimited) */
  constructor(rpm) {
    this.rpm = rpm ?? null
    /** @type {number[]} */
    this.timestamps = []
  }

  /** Milliseconds the caller must wait before the next request is allowed. */
  waitMs(now = Date.now()) {
    if (!this.rpm) return 0
    const window = 60_000
    const cutoff = now - window
    this.timestamps = this.timestamps.filter((t) => t > cutoff)
    if (this.timestamps.length < this.rpm) return 0
    const oldest = this.timestamps[0]
    return Math.max(0, oldest + window - now)
  }

  /** Record that a request was sent. */
  mark(now = Date.now()) {
    this.timestamps.push(now)
  }

  /** Reserve a slot, sleeping if needed. */
  async acquire(now = Date.now()) {
    const wait = this.waitMs(now)
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    this.mark()
  }
}

/**
 * Tracks daily token pools (e.g. APInex 10M/day) and the weight of the model
 * that is spending from it.
 */
export class PoolTracker {
  constructor() {
    /** @type {Map<string, {limit: number, used: number, day: string}>} */
    this.pools = new Map()
  }

  static today(now = new Date()) {
    return now.toISOString().slice(0, 10)
  }

  /**
   * Register a pool limit.
   * @param {string} provider
   * @param {number} limit tokens per day
   */
  register(provider, limit) {
    const day = PoolTracker.today()
    const cur = this.pools.get(provider)
    if (!cur || cur.day !== day) this.pools.set(provider, { limit, used: 0, day })
    else cur.limit = limit
  }

  /**
   * Charge a pool.
   * @returns {boolean} false when the pool is exhausted
   */
  charge(provider, tokens, weight = 1) {
    const p = this.pools.get(provider)
    if (!p) return true
    p.used += tokens * weight
    return p.used <= p.limit
  }

  /** @returns {{limit: number, used: number, left: number, ratio: number}} */
  status(provider) {
    const p = this.pools.get(provider)
    if (!p) return { limit: 0, used: 0, left: 0, ratio: 1 }
    return {
      limit: p.limit,
      used: p.used,
      left: Math.max(0, p.limit - p.used),
      ratio: p.limit ? Math.max(0, 1 - p.used / p.limit) : 1,
    }
  }
}

/**
 * Classify an upstream error so the router knows whether to retry, fall
 * back, or give up.
 */
export function classify(err) {
  const status = err?.status ?? err?.response?.status ?? 0
  const message = String(err?.message ?? err?.body?.error?.message ?? err ?? "")
  if (status === 429 || /rate limit/i.test(message)) return "rate_limit"
  if (status === 402 || /insufficient balance|free .* tokens used|subscription/i.test(message))
    return "quota_exhausted"
  if (status === 401 || status === 403 || /invalid.*key|unauthorized/i.test(message)) return "auth"
  if (status >= 500) return "upstream"
  return "error"
}

/** True when the failure means "this provider cannot serve right now". */
export function isFatal(kind) {
  return kind === "quota_exhausted" || kind === "auth"
}
