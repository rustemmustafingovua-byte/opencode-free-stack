import { test } from "node:test"
import assert from "node:assert/strict"
import { RateLimiter, PoolTracker, classify, isFatal } from "../src/quota.js"
import { FreeRouter } from "../src/router.js"
import { fallbackChain, listFreeModels } from "../src/providers.js"

test("RateLimiter respects the per-minute cap", async () => {
  const rl = new RateLimiter(5)
  const now = Date.now()
  for (let i = 0; i < 5; i++) rl.mark(now)
  assert.ok(rl.waitMs(now) > 0, "sixth request must wait")
  assert.equal(new RateLimiter(null).waitMs(now), 0, "unlimited limiter never waits")
})

test("PoolTracker charges weighted tokens and reports the remainder", () => {
  const p = new PoolTracker()
  p.register("apinex", 1000)
  assert.equal(p.charge("apinex", 100, 3), true)
  const s = p.status("apinex")
  assert.equal(s.used, 300)
  assert.equal(s.left, 700)
  assert.equal(p.charge("apinex", 400, 3), false, "must refuse to exceed the pool")
})

test("classify maps upstream errors to actionable kinds", () => {
  assert.equal(classify({ status: 429, message: "Rate limit exceeded" }), "rate_limit")
  assert.equal(classify({ status: 402, message: "Free 10M tokens used." }), "quota_exhausted")
  assert.equal(classify({ status: 401, message: "Invalid API key" }), "auth")
  assert.equal(classify({ status: 500, message: "boom" }), "upstream")
  assert.ok(isFatal("quota_exhausted"))
  assert.ok(!isFatal("rate_limit"))
})

test("fallback chain prefers the strongest model of each provider", () => {
  const chain = fallbackChain(["apinex"])
  assert.equal(chain[0].provider, "apinex")
  assert.equal(chain[0].model, "free/qwen-3.8-max")
  assert.ok(chain.length >= 9, "all free models of the provider are in the chain")
})

test("registry exposes only free models for the free providers", () => {
  const rows = listFreeModels()
  assert.ok(rows.length > 15)
  assert.ok(rows.every((r) => !r.model.startsWith("paid")))
  const apinex = rows.filter((r) => r.provider === "apinex")
  assert.ok(apinex.every((r) => r.weight >= 2), "apinex models carry a pool weight")
})

test("router falls back to the next provider when one is out of quota", async () => {
  const calls = []
  const original = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body)
    calls.push(body.model)
    if (body.model === "minimax-m3.1-flash-free") {
      return new Response(JSON.stringify({ error: { message: "Free 10M tokens used." } }), { status: 402 })
    }
    return new Response(
      JSON.stringify({ choices: [{ message: { content: "ok" } }], usage: { total_tokens: 5 } }),
      { status: 200 },
    )
  }
  try {
    const r = new FreeRouter({ keys: { zen: "k" } })
    const res = await r.chat([{ role: "user", content: "hi" }], { providers: ["zen"] })
    assert.equal(res.ok, true)
    assert.equal(res.model, "glm-5.3-flash-free", "the next preferred model must serve it")
    assert.equal(calls.length, 2, "the failing model must be tried first and skipped")
  } finally {
    globalThis.fetch = original
  }
})

test("router reports every attempt when all providers fail", async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: "nope" } }), { status: 500 })
  try {
    const r = new FreeRouter({ keys: { zen: "k" } })
    const res = await r.chat([{ role: "user", content: "hi" }], { providers: ["zen"] })
    assert.equal(res.ok, false)
    assert.ok(res.attempts.length > 0)
  } finally {
    globalThis.fetch = original
  }
})
