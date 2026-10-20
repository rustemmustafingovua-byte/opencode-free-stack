#!/usr/bin/env node
/**
 * growth.mjs — daily growth digest for the portfolio.
 *
 *   node growth.mjs           today's snapshot
 *   node growth.mjs --save    append the snapshot to growth.jsonl
 *   node growth.mjs --check   actionable next steps (unanswered issues, stale releases)
 *
 * Reads the GitHub token from GITHUB_TOKEN or ~/.config/opencode/secrets/github.key
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const REPOS = [
  "opencode-free-stack",
  "free-web-mcp",
  "agent-x402",
  "mcp-doctor",
  "mcp-proxy",
  "tool-schema-lint",
  "prompt-budget",
  "agent-cost-guard",
  "opencode-doctor",
  "free-tier-tracker",
  "x402-priceboard",
  "prompt-injection-guard",
  "readme-doctor",
  "lumen-chain",
]
const ON_NPMJS = new Set(["mcp-doctor", "mcp-proxy", "agent-cost-guard", "readme-doctor"])
const OWNER = "rustemmustafingovua-byte"

const SECRETS = join(homedir(), ".config", "opencode", "secrets")
const token = () => {
  const env = process.env.GITHUB_TOKEN
  if (env && env.trim()) return env.trim()
  const f = join(SECRETS, "github.key")
  return existsSync(f) ? readFileSync(f, "utf8").trim() : ""
}
const H = () => {
  const t = token()
  return { Accept: "application/vnd.github+json", ...(t ? { Authorization: `Bearer ${t}` } : {}) }
}

async function gh(path) {
  try {
    const res = await fetch(`https://api.github.com${path}`, { headers: H() })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

const dim = (s) => `\x1b[2m${s}\x1b[0m`
const ok = (s) => `\x1b[32m${s}\x1b[0m`
const warn = (s) => `\x1b[33m${s}\x1b[0m`

async function snapshot() {
  const rows = []
  for (const name of REPOS) {
    const repo = await gh(`/repos/${OWNER}/${name}`)
    if (!repo) {
      rows.push({ repo: name, error: "unreachable" })
      continue
    }
    const issues = await gh(`/repos/${OWNER}/${name}/issues?state=open&per_page=50`)
    const open = (issues || []).filter((i) => !i.pull_request)
    const rel = await gh(`/repos/${OWNER}/${name}/releases/latest`)
    const runs = await gh(`/repos/${OWNER}/${name}/actions/runs?per_page=5`)
    const failed = (runs?.workflow_runs || []).filter((r) => r.conclusion === "failure").length
    const npmStatus = ON_NPMJS.has(name) ? "npmjs" : "github-packages"
    rows.push({
      repo: name,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      watchers: repo.subscribers_count,
      openIssues: open.length,
      lastPush: (repo.pushed_at || "").slice(0, 10),
      latestRelease: rel?.tag_name || null,
      topics: repo.topics || [],
      ciFailed: failed,
      registry: npmStatus,
    })
  }
  return rows
}

async function actionable() {
  const out = []
  for (const name of REPOS) {
    const issues = await gh(`/repos/${OWNER}/${name}/issues?state=open&per_page=50`)
    for (const i of (issues || []).filter((x) => !x.pull_request)) {
      out.push({
        repo: name,
        number: i.number,
        title: i.title,
        age: Math.round((Date.now() - new Date(i.created_at).getTime()) / 86400000),
        comments: i.comments,
        url: i.html_url,
      })
    }
  }
  return out
}

const args = process.argv.slice(2)
const rows = await snapshot()

console.log(ok("\n=== Portfolio snapshot ==="))
for (const r of rows) {
  if (r.error) {
    console.log(warn(`  ${r.repo}: ${r.error}`))
    continue
  }
  console.log(
    `  ${r.repo.padEnd(24)} ★${String(r.stars).padEnd(5)} forks ${String(r.forks).padEnd(4)} issues ${String(r.openIssues).padEnd(4)} rel ${r.latestRelease || "-"}  push ${r.lastPush}${r.ciFailed ? warn(`  CI провалов: ${r.ciFailed}`) : ""}`,
  )
  console.log(dim(`     topics: ${r.topics.join(", ") || "—"}`))
}

const todo = await actionable()
if (todo.length) {
  console.log(ok("\n=== Open issues ==="))
  for (const t of todo) {
    console.log(`  ${t.repo}#${t.number} (${t.age}д, ${t.comments} комм.) ${t.title.slice(0, 60)}`)
    console.log(dim(`     ${t.url}`))
  }
} else {
  console.log(ok("\n=== Open issues ===\n  none — good time to open a bounty for it"))
}

if (args.includes("--save")) {
  const line = JSON.stringify({ date: new Date().toISOString(), rows })
  const f = join(process.cwd(), "growth.jsonl")
  appendFileSync(f, line + "\n")
  console.log(dim(`\nsnapshot appended to ${f}`))
}

if (args.includes("--check")) {
  console.log(ok("\n=== Next actions ==="))
  const needsNpm = true
  console.log("  1. npm login (owner) -> publish the three packages")
  console.log("  2. register free-web-mcp in Smithery / mcp.so")
  console.log("  3. host the registry + MCP with an x402 price (0.001 USDC/call)")
  console.log("  4. one launch post per repo (HN Show HN, Reddit, X)")
  console.log(`  5. fund the first bounty with the first revenue${needsNpm ? "" : ""}`)
}
