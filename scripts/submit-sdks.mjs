#!/usr/bin/env node
/**
 * submit-sdks.mjs — бесплатная дистрибуция в списках SDK/инструментов для агентов.
 *
 * Формат списка e2b-dev/awesome-sdks-for-ai-agents:
 *
 *   ## [Name](https://github.com/owner/repo)
 *   One-line description
 *
 *   <details>
 *
 *   <!-- ### Description -->
 *
 *   ### Links
 *   - [Web](https://…)
 *   - [GitHub](https://github.com/owner/repo)
 *   </details>
 *
 *   node scripts/submit-sdks.mjs [--dry]
 */
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

const WORKSPACE = join(homedir(), "workspace")
const OWNER = "rustemmustafingovua-byte"
const TOKEN = readFileSync(join(homedir(), ".config/opencode/secrets/github.key"), "utf8").trim()
const H = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/vnd.github+json",
  "Content-Type": "application/json",
  "User-Agent": "portfolio-bot",
}
const dry = process.argv.includes("--dry")

const TARGET = {
  repo: "e2b-dev/awesome-sdks-for-ai-agents",
  branch: "main",
  file: "README.md",
}

const ENTRIES = [
  {
    name: "free-web-mcp",
    desc: "Web search and page reading for AI agents with zero API credits — no key, no credit card, no metered calls. Free tier 30 requests/hour, paid tier 0.001 USDC per call over x402. Also live as a public MCP endpoint.",
    url: `https://github.com/${OWNER}/free-web-mcp`,
  },
  {
    name: "agent-browser-mcp",
    desc: "A real browser for AI agents — navigation, reading, clicking, typing — with Cloudflare and captcha handling under an explicit budget and domain allowlist. Uses the browser already installed on the machine.",
    url: `https://github.com/${OWNER}/agent-browser-mcp`,
  },
  {
    name: "agent-cost-guard",
    desc: "A budget in front of any OpenAI-compatible endpoint: daily spend cap, per-request cap and session limits enforced before the call, so an agent cannot burn a credit card by accident.",
    url: `https://github.com/${OWNER}/agent-cost-guard`,
  },
  {
    name: "mcp-doctor",
    desc: "Health check for MCP servers: probes every configured server, lists its tools, measures latency and classifies the failure as spawn, handshake, timeout, auth or empty instead of dumping a stack trace.",
    url: `https://github.com/${OWNER}/mcp-doctor`,
  },
  {
    name: "prompt-injection-guard",
    desc: "Finds instructions hidden where an agent reads automatically — including policy-swap, delegation, fake-truncated-context and code-completion injections that pass naive keyword filters.",
    url: `https://github.com/${OWNER}/prompt-injection-guard`,
  },
]

async function api(method, path, body) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: H,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {}
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${(json?.message || text).slice(0, 160)}`)
  return json
}

function entryBlock(e) {
  return `## [${e.name}](${e.url})
${e.desc}

<details>

<!-- ### Description -->

### Links
- [Web](${e.url})
- [GitHub](${e.url})
</details>
`
}

// 1) форк: имя GitHub выбирает сам, поэтому ищем его в списке форков
async function findFork() {
  const forks = await api("GET", `/repos/${TARGET.repo}/forks?per_page=100`)
  return (forks || []).find((f) => f.owner?.login === OWNER) || null
}

let fork = await findFork()
if (!fork) {
  console.log("  форка нет — создаю")
  if (!dry) await api("POST", `/repos/${TARGET.repo}/forks`, {})
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1500))
    fork = await findFork()
    if (fork) break
  }
}
if (!fork) {
  console.log("  форк не появился")
  process.exit(1)
}
const forkName = fork.name
console.log("  форк:", `${OWNER}/${forkName}`)

// 2) клон и правка
const work = join("/tmp", `sdks-${process.pid}`)
rmSync(work, { recursive: true, force: true })
mkdirSync(work, { recursive: true })
const cloneUrl = `https://x-access-token:${TOKEN}@github.com/${OWNER}/${forkName}.git`
try {
  execFileSync("git", ["clone", "--depth", "1", cloneUrl, work], { stdio: ["ignore", "ignore", "pipe"] })
} catch (e) {
  console.log("  клон не удался:", String(e.stderr || e.message).slice(0, 160))
  process.exit(1)
}

const file = join(work, TARGET.file)
let content = readFileSync(file, "utf8")
let added = 0
for (const e of ENTRIES) {
  if (content.includes(`[${e.name}](${e.url})`)) {
    console.log(`  ${e.name}: уже есть`)
    continue
  }
  // вставляем в алфавитном порядке по имени проекта
  const lines = content.split("\n")
  const starts = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^## \[([^\]]+)\]/)
    if (m) starts.push({ i, name: m[1] })
  }
  let at = lines.length
  for (const s of starts) {
    if (s.name.toLowerCase() > e.name.toLowerCase()) {
      at = s.i
      break
    }
  }
  const block = entryBlock(e).split("\n")
  lines.splice(at, 0, ...block)
  content = lines.join("\n")
  added++
  console.log(`  ${e.name}: добавлен (позиция ${at})`)
}
if (!added) {
  console.log("  добавлять нечего")
  process.exit(0)
}
if (dry) {
  console.log("  --dry: не коммичу")
  process.exit(0)
}
writeFileSync(file, content)

const sh = (cmd, args) => execFileSync("git", ["-C", work, cmd, ...args], { stdio: ["ignore", "pipe", "pipe"] })
const branch = `add/${OWNER}-agent-tools`
sh("checkout", ["-B", branch])
sh("config", ["user.name", OWNER])
sh("config", ["user.email", `${OWNER}@users.noreply.github.com`])
sh("add", [TARGET.file])
sh("commit", ["-m", `Add ${OWNER} agent tooling (MCP servers, cost control, browser)`])
sh("push", ["--force", "origin", branch])

const pr = await api("POST", `/repos/${TARGET.repo}/pulls`, {
  title: `Add ${OWNER} agent tooling`,
  head: `${OWNER}:${branch}`,
  base: TARGET.branch,
  body: [
    `Adds five MIT tools for AI agents from \`${OWNER}\`:`,
    "",
    "- **free-web-mcp** — web search and page reading with zero API credits; paid tier over x402. Published as a public MCP endpoint.",
    "- **agent-browser-mcp** — a real browser for agents with Cloudflare/captcha handling under a budget.",
    "- **agent-cost-guard** — a budget in front of any OpenAI-compatible endpoint.",
    "- **mcp-doctor** — health check for MCP servers with latency and failure classification.",
    "- **prompt-injection-guard** — finds hidden instructions, including injections that pass naive filters.",
    "",
    "All are open source, tested in CI, and installable with one command.",
  ].join("\n"),
})
console.log("  PR:", pr.html_url)
