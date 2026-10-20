// Integration test against the real service. Skipped unless LIVE=1.
//   LIVE=1 npm test
import { test } from "node:test"
import assert from "node:assert/strict"

const LIVE = process.env.LIVE === "1"
const skip = LIVE ? false : "set LIVE=1 to run the integration test"

import { FreeRouter } from "../src/index.js"

test("a real free model answers", { skip }, async () => {
  const key = process.env.GITHUB_TOKEN
  if (!key) return
  const router = new FreeRouter({ keys: { copilot: key } })
  const res = await router.chat([{ role: "user", content: "Reply with the single word: OK" }], {
    providers: ["copilot"],
    maxTokens: 20,
  })
  assert.equal(res.ok, true, JSON.stringify(res.attempts))
  assert.match(res.content, /ok/i)
})
