#!/usr/bin/env node
/**
 * live-tests.mjs — adds an opt-in integration test to every project.
 * The test talks to the real service and is skipped unless LIVE=1 is set:
 *
 *   LIVE=1 npm test
 */
import { writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

const WORKSPACE = join(homedir(), "workspace")

const HEAD = `// Integration test against the real service. Skipped unless LIVE=1.
//   LIVE=1 npm test
import { test } from "node:test"
import assert from "node:assert/strict"

const LIVE = process.env.LIVE === "1"
const skip = LIVE ? false : "set LIVE=1 to run the integration test"
`

const TESTS = {
  "mcp-doctor": {
    file: "test/live.test.js",
    body: `${HEAD}
import { doctor, normalizeServer } from "../src/index.js"

test("probes a real MCP server over stdio", { skip }, async () => {
  const server = normalizeServer("free-web-mcp", {
    command: ["node", "${join(WORKSPACE, "free-web-mcp", "bin", "free-web-mcp.js")}"],
  })
  const report = await doctor([server], { timeoutMs: 30000 })
  assert.equal(report.total, 1)
  assert.equal(report.healthy, 1, "the live server should be healthy: " + JSON.stringify(report.results))
  assert.ok(report.results[0].tools >= 5, "it should expose the five tools")
})
`,
  },
  "x402-priceboard": {
    file: "test/live.test.js",
    body: `${HEAD}
import { board } from "../src/index.js"

test("reads the real price of an x402 endpoint", { skip }, async () => {
  const data = await board(["https://api.venice.ai/api/v1/chat/completions"], { method: "GET" })
  assert.ok(data.results.length === 1)
  if (data.rows.length) {
    assert.ok(data.rows[0].amountUsd > 0)
    assert.ok(data.rows[0].network.includes("8453") || data.rows[0].network.includes("solana"))
  }
})
`,
  },
  "free-web-mcp": {
    file: "test/live.test.js",
    body: `${HEAD}
import { read, search, hn } from "../src/index.js"

test("searches Hacker News for real", { skip }, async () => {
  const hits = await hn("opencode", { limit: 2 })
  assert.ok(Array.isArray(hits))
  assert.ok(hits.length > 0, "the live search should return hits")
})

test("reads a page as markdown", { skip }, async () => {
  const page = await read("https://example.com", { maxChars: 2000 })
  assert.ok(page.markdown.length > 0)
})
`,
  },
  "opencode-free-stack": {
    file: "test/live.test.js",
    body: `${HEAD}
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
`,
  },
  "agent-x402": {
    file: "test/live.test.js",
    body: `${HEAD}
import { X402Client } from "../src/index.js"

test("reads the real payment terms of an x402 endpoint", { skip }, async () => {
  const client = new X402Client({})
  const res = await client.fetch("https://api.venice.ai/api/v1/chat/completions", {
    method: "GET",
    dryRun: true,
  })
  if (res.requirements) {
    assert.ok(res.amountUsd > 0, "the endpoint should quote a price")
    assert.ok(res.option.network)
  } else {
    assert.equal(res.response.status, 200)
  }
})
`,
  },
  "free-tier-tracker": {
    file: "test/live.test.js",
    body: `${HEAD}
import { Tracker, detectLimit } from "../src/index.js"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

test("the real APInex pool reports its state", { skip }, async () => {
  const key = process.env.APINEX_API_KEY
  if (!key) return
  const res = await fetch("https://api.apinex.bond/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: \`Bearer \${key}\`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "free/deepseek-v4-flash-0731",
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
    }),
  })
  const body = await res.json()
  if (res.ok) {
    const tracker = new Tracker(join(mkdtempSync(join(tmpdir(), "ftt-")), "state.json"))
    tracker.reset("apinex")
    assert.equal(tracker.status().providers.find((p) => p.provider === "apinex").exhausted, false)
  } else {
    assert.equal(detectLimit(body?.error?.message).provider, "apinex")
  }
})
`,
  },
  "prompt-injection-guard": {
    file: "test/live.test.js",
    body: `${HEAD}
import { scanFiles } from "../src/index.js"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

test("scans a real rules file", { skip }, () => {
  const file = join(homedir(), ".config", "opencode", "AGENTS.md")
  if (!file) return
  let content
  try {
    content = readFileSync(file, "utf8")
  } catch {
    return
  }
  const report = scanFiles([{ name: "AGENTS.md", content }])
  assert.equal(typeof report.score, "number")
  assert.ok(report.findings.every((f) => typeof f.severity === "string"))
})
`,
  },
  "readme-doctor": {
    file: "test/live.test.js",
    body: `${HEAD}
import { audit } from "../src/index.js"
import { join } from "node:path"
import { homedir } from "node:os"

test("audits this repository's own README", { skip }, () => {
  const dir = join(homedir(), "workspace", "readme-doctor")
  const report = audit(dir)
  assert.ok(report.readme, "the repository must have a README")
  assert.ok(report.score > 40, "our own README should score well: " + report.score)
})
`,
  },
  "tool-schema-lint": {
    file: "test/live.test.js",
    body: `${HEAD}
import { lintTools } from "../src/index.js"

test("lints a real tool list from an MCP server", { skip }, async () => {
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js")
  const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js")
  const transport = new StdioClientTransport({
    command: "node",
    args: ["${join(WORKSPACE, "free-web-mcp", "bin", "free-web-mcp.js")}"],
  })
  const client = new Client({ name: "lint-test", version: "0.1.0" }, { capabilities: {} })
  await client.connect(transport)
  const { tools } = await client.listTools()
  await client.close()
  const report = lintTools(tools)
  assert.ok(report.tools >= 5)
  assert.equal(report.errors, 0, "our own tools should have no error-level findings")
})
`,
  },
  "opencode-doctor": {
    file: "test/live.test.js",
    body: `${HEAD}
import { audit } from "../src/index.js"
import { join } from "node:path"
import { homedir } from "node:os"

test("audits the local OpenCode install", { skip }, () => {
  const report = audit({
    configPath: join(homedir(), ".config", "opencode", "opencode.jsonc"),
  })
  assert.ok(report.config, "the config must parse")
  assert.equal(typeof report.score, "number")
})
`,
  },
  "prompt-budget": {
    file: "test/live.test.js",
    body: `${HEAD}
import { report } from "../src/index.js"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

test("measures a real rules file", { skip }, () => {
  let rules
  try {
    rules = readFileSync(join(homedir(), ".config", "opencode", "AGENTS.md"), "utf8")
  } catch {
    return
  }
  const r = report({ rules })
  assert.ok(r.rules.tokens > 0)
  assert.ok(r.perRequestTokens >= r.rules.tokens)
})
`,
  },
  "mcp-proxy": {
    file: "test/live.test.js",
    body: `${HEAD}
import { Proxy } from "../src/index.js"

test("routes a request through the proxy", { skip }, async () => {
  const proxy = new Proxy({
    apiKey: "test-key",
    transport: async (req) => ({ status: 200, body: { ok: true, server: req.server } }),
  })
  const res = await proxy.handle({
    server: "demo",
    method: "POST",
    path: "/mcp",
    client: "test",
    headers: { authorization: "Bearer test-key" },
  })
  assert.equal(res.status, 200)
  assert.equal(proxy.log.stats().total, 1)
  const denied = await proxy.handle({ server: "demo", headers: { authorization: "Bearer wrong" } })
  assert.equal(denied.status, 401)
})
`,
  },
}

for (const [slug, t] of Object.entries(TESTS)) {
  const dir = join(WORKSPACE, slug)
  if (!existsSync(dir)) continue
  writeFileSync(join(dir, t.file), t.body)
  console.log(`  ✓ ${slug}/${t.file}`)
}
console.log("live tests written")
