import { test } from "node:test"
import assert from "node:assert/strict"
import { isFreeTierFailure, reasonOf, nextModel } from "../src/fallback.js"

test("recognises free-tier failures", () => {
  assert.equal(isFreeTierFailure("Free 10M tokens used. Buy a subscription"), true)
  assert.equal(isFreeTierFailure("429 Rate limit exceeded. Max 5 requests per minute"), true)
  assert.equal(isFreeTierFailure("Insufficient balance"), true)
  assert.equal(isFreeTierFailure("network timeout"), false)
  assert.equal(isFreeTierFailure(""), false)
})

test("explains why a fallback happened", () => {
  assert.equal(reasonOf("Free 10M tokens used"), "daily pool exhausted")
  assert.equal(reasonOf("429 rate limit"), "rate limited")
  assert.equal(reasonOf("Insufficient balance"), "balance too low")
})

test("walks the chain forward and skips models already tried", () => {
  const chain = [
    { provider: "apinex", model: "free/qwen-3.8-max" },
    { provider: "apinex", model: "free/deepseek-v4-pro-0813" },
    { provider: "copilot", model: "gpt-4.1" },
  ]
  const tried = new Set(["apinex/free/qwen-3.8-max"]) // the model that just failed
  const first = nextModel(chain, "apinex", "free/qwen-3.8-max", tried)
  assert.equal(first.key, "apinex/free/deepseek-v4-pro-0813")

  tried.add("apinex/free/deepseek-v4-pro-0813")
  const second = nextModel(chain, "apinex", "free/deepseek-v4-pro-0813", tried)
  assert.equal(second.key, "copilot/gpt-4.1")

  tried.add("copilot/gpt-4.1")
  assert.equal(nextModel(chain, "copilot", "gpt-4.1", tried), null)
})
