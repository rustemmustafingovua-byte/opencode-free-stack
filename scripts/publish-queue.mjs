#!/usr/bin/env node
/**
 * publish-queue.mjs — publishes the remaining projects, one at a time, with
 * backoff. GitHub throttles content creation for new accounts, so this keeps
 * retrying until everything is through.
 *
 *   node scripts/publish-queue.mjs
 */
import { publish } from "./scaffold.mjs"
import { appendFileSync, existsSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

const QUEUE = [
  ["agent-cost-guard", ["cost-control", "proxy", "agents", "budget", "openai-compatible", "llm", "guardrails"], "A budget in front of any OpenAI-compatible endpoint."],
  ["opencode-doctor", ["opencode", "doctor", "diagnostics", "config", "devtools", "agents", "audit"], "Audit an OpenCode install in one command."],
  ["free-tier-tracker", ["free-tier", "quota", "limits", "agents", "cost-control", "monitoring", "llm"], "Know your free quota before it runs out."],
  ["x402-priceboard", ["x402", "usdc", "base", "solana", "pricing", "agents", "micropayments", "crypto"], "The price list of x402 endpoints, without paying anything."],
  ["prompt-injection-guard", ["security", "prompt-injection", "agents", "llm", "scanner", "sanitizer", "audit"], "Find the instructions hidden in the files your agent reads by itself."],
  ["readme-doctor", ["readme", "documentation", "open-source", "developer-tools", "audit", "docs", "github"], "Why nobody is using your repository — checked in one command."],
]

const LOG = join(homedir(), ".local", "state", "publish-queue.log")
const DONE = join(homedir(), ".local", "state", "publish-queue.done.json")

const log = (m) => {
  const line = `[${new Date().toISOString()}] ${m}`
  console.log(line)
  try {
    appendFileSync(LOG, line + "\n")
  } catch {}
}

const done = existsSync(DONE) ? JSON.parse(readFileSync(DONE, "utf8")) : []
const pending = QUEUE.filter(([slug]) => !done.includes(slug))

log(`queue: ${pending.length} pending of ${QUEUE.length}`)

let wait = 60_000
for (const [slug, topics, desc] of pending) {
  let ok = false
  for (let attempt = 1; attempt <= 40 && !ok; attempt++) {
    try {
      await publish(slug, topics, desc)
      ok = true
      done.push(slug)
      try {
        writeFileSync(DONE, JSON.stringify(done, null, 2))
      } catch {}
      log(`✓ ${slug}`)
      // сразу засеваем issue для опубликованного репо
      try {
        const { execFileSync } = await import("node:child_process")
        execFileSync("node", [join(homedir(), "workspace", "opencode-free-stack", "scripts", "seed-issues.mjs"), slug], {
          stdio: "ignore",
        })
      } catch {}
    } catch (err) {
      const msg = String(err?.message ?? err).slice(0, 140)
      log(`  retry ${attempt} ${slug}: ${msg}`)
      await new Promise((r) => setTimeout(r, wait))
      wait = Math.min(wait * 1.4, 5 * 60_000)
    }
  }
  if (!ok) log(`✗ ${slug} — не опубликован после всех попыток`)
  await new Promise((r) => setTimeout(r, 45_000))
}
log("queue finished")
