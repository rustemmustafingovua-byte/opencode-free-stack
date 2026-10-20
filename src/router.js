/**
 * The router: send a chat request to the best free model that can actually
 * serve it right now.
 *
 * Behaviour:
 *   - walks a fallback chain of (provider, model) pairs
 *   - respects per-provider RPM limits
 *   - classifies failures and skips providers that are out of quota
 *   - returns which model answered, and why the others did not
 */

import { PROVIDERS, fallbackChain, listFreeModels } from "./providers.js"
import { RateLimiter, PoolTracker, classify, isFatal } from "./quota.js"

export class FreeRouter {
  /**
   * @param {object} [opts]
   * @param {Record<string,string>} [opts.keys] provider id -> api key
   * @param {Record<string,number>} [opts.rpm] provider id -> rpm override
   */
  constructor(opts = {}) {
    this.keys = opts.keys || {}
    this.limiters = new Map()
    this.pools = new PoolTracker()
    for (const p of Object.values(PROVIDERS)) {
      if (p.dailyTokens) this.pools.register(p.id, p.dailyTokens)
      this.limiters.set(p.id, new RateLimiter(opts.rpm?.[p.id] ?? p.rpm))
    }
  }

  /** Provide (or override) the key for a provider. */
  setKey(provider, key) {
    this.keys[provider] = key
    return this
  }

  /** Providers that currently have a key configured. */
  ready() {
    return Object.values(PROVIDERS)
      .filter((p) => this.keys[p.id])
      .map((p) => p.id)
  }

  /** Snapshot of every provider's quota state. */
  status() {
    return Object.values(PROVIDERS).map((p) => ({
      provider: p.id,
      name: p.name,
      hasKey: !!this.keys[p.id],
      rpm: p.rpm ?? null,
      freeModels: (p.freeModels || []).length,
      pool: p.dailyTokens ? this.pools.status(p.id) : null,
      notes: p.notes,
    }))
  }

  /**
   * Send one chat completion, falling back through free models.
   *
   * @param {Array<{role: string, content: string}>} messages
   * @param {object} [opts]
   * @param {number} [opts.maxTokens]
   * @param {number} [opts.temperature]
   * @param {string[]} [opts.providers] restrict to these providers
   * @param {boolean} [opts.dryRun] resolve the chain without calling out
   */
  async chat(messages, opts = {}) {
    const chain = fallbackChain(opts.providers?.length ? opts.providers : this.ready())
    if (!chain.length) {
      return { ok: false, error: "no free provider has a key configured" }
    }
    if (opts.dryRun) {
      return { ok: true, dryRun: true, chain }
    }

    const attempts = []
    for (const { provider, model } of chain) {
      const p = PROVIDERS[provider]
      const limiter = this.limiters.get(provider)
      await limiter.acquire()

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.keys[provider]}`,
        ...(p.headers || {}),
      }
      const body = {
        model,
        messages,
        max_tokens: opts.maxTokens ?? 2000,
        temperature: opts.temperature ?? 0.3,
      }

      let res
      let text
      try {
        res = await fetch(`${p.baseURL}/chat/completions`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000),
        })
        text = await res.text()
      } catch (e) {
        attempts.push({ provider, model, kind: "network", error: String(e?.message ?? e) })
        continue
      }

      if (!res.ok) {
        let parsed = {}
        try {
          parsed = JSON.parse(text)
        } catch {}
        const kind = classify({ status: res.status, message: parsed?.error?.message ?? text })
        attempts.push({ provider, model, kind, status: res.status, error: parsed?.error?.message ?? text.slice(0, 200) })
        if (kind === "quota_exhausted" && p.dailyTokens) {
          // burn the rest of the pool so we stop hitting it today
          this.pools.charge(provider, p.dailyTokens, 1)
        }
        if (kind === "rate_limit") continue
        if (isFatal(kind)) continue
        continue
      }

      let json = {}
      try {
        json = JSON.parse(text)
      } catch {}
      const usage = json.usage || {}
      if (p.dailyTokens) {
        const tokens = (usage.prompt_tokens || 0) + (usage.completion_tokens || 0)
        this.pools.charge(provider, tokens, p.weight || 1)
      }
      return {
        ok: true,
        provider,
        model,
        content: json.choices?.[0]?.message?.content ?? "",
        reasoning: json.choices?.[0]?.message?.reasoning_content ?? "",
        usage,
        attempts,
      }
    }
    return { ok: false, error: "every free model failed", attempts }
  }
}

/** Convenience: build a router from environment variables. */
export function routerFromEnv(env = process.env) {
  const keys = {}
  for (const p of Object.values(PROVIDERS)) {
    for (const name of p.env) {
      if (env[name]) {
        keys[p.id] = env[name]
        break
      }
    }
  }
  return new FreeRouter({ keys })
}

/** Every free model known to the registry. */
export function freeModels() {
  return listFreeModels()
}
