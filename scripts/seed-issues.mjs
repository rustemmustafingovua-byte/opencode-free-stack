#!/usr/bin/env node
/**
 * seed-issues.mjs — give every published repo a real starting point:
 * one "good first issue", one bounty-eligible issue and one docs issue.
 * Only issues for repositories that already exist.
 */
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

const OWNER = "rustemmustafingovua-byte"
const KEY = join(homedir(), ".config", "opencode", "secrets", "github.key")
const TOKEN = existsSync(KEY) ? readFileSync(KEY, "utf8").trim() : process.env.GITHUB_TOKEN
const H = { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" }

const ISSUES = {
  "mcp-doctor": [
    ["✨ Feature", "Support MCP servers behind a gateway path", "Some deployments only expose a server at a path prefix (`/sse/mcp`).\n\nAcceptance:\n- `--url` keeps the path intact\n- the probe reports the exact URL it used\n- a test covers it"],
    ["💰 Reward", "Add a config file mode that probes every server in a JSON file", "Today mcp-doctor reads one config. A `--servers servers.json` mode would let CI check a whole fleet.\n\nAcceptance:\n- `--servers <file>` probes every entry\n- exit code 1 when any server is broken\n- the README documents it"],
    ["📚 Docs", "Write down the failure taxonomy with real error messages", "A table of failure -> cause -> fix, taken from real logs."],
  ],
  "mcp-proxy": [
    ["✨ Feature", "Add per-route rate limits", "Limits exist per client; some deployments need them per server as well.\n\nAcceptance:\n- `--rpm-server` flag\n- the limiter is checked before the client limiter\n- tests cover both"],
    ["💰 Reward", "Persist the request log to disk with rotation", "In-memory logs vanish on restart. A JSONL file with size-based rotation makes the proxy usable for post-mortems.\n\nAcceptance:\n- logs are appended to `~/.mcp-proxy/log.jsonl`\n- rotation at a configurable size\n- a test reads the file back"],
    ["📚 Docs", "Document the threat model of a shared MCP endpoint", "Who can reach it, what a client key protects, what it does not."],
  ],
  "tool-schema-lint": [
    ["✨ Feature", "Check descriptions against the parameter names", "A description that never mentions a required parameter is the most common cause of wrong tool calls.\n\nAcceptance:\n- the check names the missing parameter\n- the severity is `warn`\n- a test covers it"],
    ["💰 Reward", "Add a `--fix` mode that rewrites descriptions", "The suggestions exist; make them applyable.\n\nAcceptance:\n- `--fix` writes a new tools.json\n- the original is kept as a backup\n- a dry-run mode prints the diff"],
    ["📚 Docs", "A catalogue of tool-description anti-patterns", "Short, concrete examples of each rule with a bad and a good version."],
  ],
  "prompt-budget": [
    ["✨ Feature", "Compare two rules files and show the difference in tokens", "Teams want to know what a change costs before merging it.\n\nAcceptance:\n- `--compare a.md b.md`\n- the output is per section\n- a test covers it"],
    ["💰 Reward", "Measure the cost of an MCP tool set inside a running agent", "Static analysis is a start; measuring the real request is better.\n\nAcceptance:\n- a mode that inspects a session's last request\n- the report matches `prompt-budget` on the same input\n- documented"],
    ["📚 Docs", "A guide to cutting a system prompt without losing behaviour", "What to move into a skill, what to delete, what to keep."],
  ],
  "agent-cost-guard": [
    ["✨ Feature", "Per-model price overrides from a JSON file", "Prices change; hard-coding them in the source is wrong.\n\nAcceptance:\n- `--prices prices.json`\n- unknown models fall back to the default price\n- a test covers the override"],
    ["💰 Reward", "Export a spend report (CSV) for accounting", "Teams need to bill or attribute spend.\n\nAcceptance:\n- `/report.csv` returns one row per session\n- the columns are model, tokens, cost, rounds\n- a test checks the header"],
    ["📚 Docs", "How to put the guard in front of a real agent", "A worked example with OpenCode, including the session header."],
  ],
  "opencode-doctor": [
    ["✨ Feature", "Check that the configured models actually answer", "A model that is listed but dead is worse than one that is missing.\n\nAcceptance:\n- `--probe` sends a one-token request to each provider\n- the report marks dead models\n- the probe is opt-in"],
    ["💰 Reward", "Detect providers that are configured but unreachable", "A stale base URL is the most common silent breakage.\n\nAcceptance:\n- a DNS/connectivity check per provider\n- the finding names the exact option\n- a test covers an unreachable host"],
    ["📚 Docs", "A checklist for a clean OpenCode install", "The short version of what the doctor checks and why each check matters."],
  ],
  "free-tier-tracker": [
    ["✨ Feature", "Per-provider alert thresholds", "Not every provider needs the same warning point.\n\nAcceptance:\n- thresholds are configurable per provider\n- the warning uses the provider's threshold\n- a test covers it"],
    ["💰 Reward", "Export the ledger to a dashboard-friendly JSON", "A single file another tool can graph.\n\nAcceptance:\n- `--export` writes one JSON object per day\n- the schema is documented\n- a test validates it"],
    ["📚 Docs", "Which free tiers actually reset, and when", "A table of the reset window for every provider we track."],
  ],
  "x402-priceboard": [
    ["✨ Feature", "Watch a list of endpoints and report price changes", "Prices move; a board that goes stale is useless.\n\nAcceptance:\n- `--watch` re-probes on an interval\n- a change is printed with the old and new price\n- the interval is configurable"],
    ["💰 Reward", "Historical price log", "Knowing that a price went up 10x is useful before you build a plan on it.\n\nAcceptance:\n- prices are stored per endpoint per day\n- `--history` prints the series\n- a test covers a change"],
    ["📚 Docs", "How x402 payment terms are structured", "A short reference for the `payment-required` payload."],
  ],
  "prompt-injection-guard": [
    ["✨ Feature", "Scan MCP tool descriptions too", "A tool description is read by the model on every call — it is an injection surface.\n\nAcceptance:\n- `--tools tools.json` scans every description\n- findings are grouped by tool\n- a test covers it"],
    ["💰 Reward", "Rules as a user-editable file", "The rule set should evolve with the threats.\n\nAcceptance:\n- `--rules rules.json` loads custom rules\n- the built-in set stays the default\n- a test covers a custom rule"],
    ["📚 Docs", "A short guide to writing agent-safe descriptions", "What to write, and what to never write."],
  ],
  "readme-doctor": [
    ["✨ Feature", "Check the README of a whole directory of repos", "A monorepo has many READMEs and nobody has time.\n\nAcceptance:\n- `--dir` walks the tree\n- the report is grouped per repository\n- a test covers it"],
    ["💰 Reward", "Suggest a rewritten first paragraph", "The first paragraph is what people read.\n\nAcceptance:\n- `--rewrite` proposes a one-liner from the title and the install line\n- the suggestion is short and specific\n- a test covers it"],
    ["📚 Docs", "Why each check exists, with a before/after example", "The rules make sense once you have seen the bad version."],
  ],
}

async function repoExists(slug) {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${slug}`, { headers: H })
  return res.status === 200
}

const only = process.argv[2]
for (const [slug, issues] of Object.entries(ISSUES)) {
  if (only && slug !== only) continue
  if (!(await repoExists(slug))) {
    console.log(`  – ${slug}: репо ещё не создано, пропускаю`)
    continue
  }
  for (const [label, title, body] of issues) {
    const res = await fetch(`https://api.github.com/repos/${OWNER}/${slug}/issues`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({ title, body, labels: [label] }),
    })
    const j = await res.json()
    console.log(`  ${res.status === 201 ? "✓" : "·"} ${slug} [${label}] ${title.slice(0, 44)}`)
    await new Promise((r) => setTimeout(r, 2500))
  }
}
console.log("issues seeded")
