#!/usr/bin/env node
/**
 * submit-awesome.mjs — add the MCP servers to punkpeye/awesome-mcp-servers.
 *
 * Fork → branch → edit the list → open a pull request. The list is the
 * highest-traffic discovery channel that exists for MCP servers.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { execFileSync } from "node:child_process"
import { homedir } from "node:os"

const UPSTREAM = "punkpeye/awesome-mcp-servers"
const OWNER = "rustemmustafingovua-byte"
const KEY = join(homedir(), ".config", "opencode", "secrets", "github.key")
const TOKEN = existsSync(KEY) ? readFileSync(KEY, "utf8").trim() : process.env.GITHUB_TOKEN
const H = { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" }
const WORK = join(homedir(), "workspace", "awesome-mcp-servers")

const ENTRIES = [
  {
    section: "developer-tools",
    repo: "free-web-mcp",
    desc: "Web search and page reading for agents with zero API credits: r.jina.ai renders any page to markdown, plus Wikipedia, Hacker News and GitHub search behind one MCP server - no key, no credit card, no metered calls.",
  },
  {
    section: "cryptography",
    repo: "agent-x402",
    desc: "Pay per API call in USDC on Base with x402 - no account and no API key - with a spend policy (daily cap, per-request cap, payee allow-list) enforced in code, so a prompt injection cannot drain the wallet.",
  },
  {
    section: "monitoring",
    repo: "mcp-doctor",
    desc: "Health check for MCP servers: probes every configured server, lists its tools, measures latency and classifies the failure as spawn, handshake, timeout, auth or empty instead of dumping a stack trace.",
  },
  {
    section: "monitoring",
    repo: "mcp-proxy",
    desc: "One endpoint in front of many MCP servers, with a single client key, per-client rate limits, an append-only request log, replay of past calls and routing by server name.",
  },
]

function badge(repo) {
  return `[![${OWNER}/${repo} MCP server](https://glama.ai/mcp/servers/${OWNER}/${repo}/badges/score.svg)](https://glama.ai/mcp/servers/${OWNER}/${repo})`
}

async function api(method, path, body) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: H,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = {}
  try {
    json = JSON.parse(text)
  } catch {}
  return { status: res.status, json, text }
}

async function ensureFork() {
  const check = await api("GET", `/repos/${OWNER}/${UPSTREAM.split("/")[1]}`)
  if (check.status === 200) return
  await api("POST", `/repos/${UPSTREAM}/forks`)
  // wait for the fork to appear
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 3000))
    const c = await api("GET", `/repos/${OWNER}/${UPSTREAM.split("/")[1]}`)
    if (c.status === 200) return
  }
  throw new Error("fork did not appear")
}

async function main() {
  await ensureFork()
  const fork = UPSTREAM.split("/")[1]
  const dir = join(WORK, fork)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
    execFileSync("git", ["clone", "--depth", "1", `https://github.com/${OWNER}/${fork}.git`, dir], { stdio: "ignore" })
  } else {
    execFileSync("git", ["fetch", "origin"], { cwd: dir, stdio: "ignore" })
    execFileSync("git", ["reset", "--hard", "origin/main"], { cwd: dir, stdio: "ignore" })
  }
  execFileSync("git", ["checkout", "-b", "feat/add-apinex-mcp-servers"], { cwd: dir })

  const readme = join(dir, "README.md")
  let md = readFileSync(readme, "utf8")
  let added = 0
  for (const e of ENTRIES) {
    const anchor = `<a name="${e.section}"></a>`
    if (!md.includes(anchor)) {
      console.log(`  – секция ${e.section} не найдена, пропуск ${e.repo}`)
      continue
    }
    if (md.includes(`[${OWNER}/${e.repo}]`)) {
      console.log(`  · ${e.repo} уже есть`)
      continue
    }
    const line = `- [${OWNER}/${e.repo}](https://github.com/${OWNER}/${e.repo}) ${badge(e.repo)} 🏠 🍎 🪟 🐧 - ${e.desc}\n`
    const idx = md.indexOf(anchor)
    const nextSection = md.indexOf("\n### ", idx + anchor.length)
    const insertAt = nextSection > 0 ? nextSection : md.length
    md = md.slice(0, insertAt) + line + md.slice(insertAt)
    added++
    console.log(`  ✓ добавлен ${e.repo} в ${e.section}`)
  }
  writeFileSync(readme, md)
  if (!added) {
    console.log("нечего добавлять")
    return
  }
  execFileSync("git", ["add", "README.md"], { cwd: dir })
  execFileSync(
    "git",
    ["commit", "-q", "-m", "Add APInex MCP servers: free-web-mcp, agent-x402, mcp-doctor, mcp-proxy"],
    { cwd: dir },
  )
  const basic = Buffer.from(`x-access-token:${TOKEN}`).toString("base64")
  execFileSync("git", ["-c", `http.extraheader=AUTHORIZATION: basic ${basic}`, "push", "-q", "origin", "feat/add-apinex-mcp-servers"], { cwd: dir })

  const body = {
    title: "Add APInex MCP servers: free-web-mcp, agent-x402, mcp-doctor, mcp-proxy",
    head: `${OWNER}:feat/add-apinex-mcp-servers`,
    base: "main",
    body: [
      "Adds four MCP servers from the APInex toolkit:",
      "",
      "| Server | Section | What it does |",
      "|---|---|---|",
      "| [free-web-mcp](https://github.com/rustemmustafingovua-byte/free-web-mcp) | Developer Tools | Web search and page reading for agents with zero API credits (r.jina.ai + Wikipedia + Hacker News + GitHub) |",
      "| [agent-x402](https://github.com/rustemmustafingovua-byte/agent-x402) | Cryptography | Pay per API call in USDC on Base with x402, with a spend policy enforced outside the model |",
      "| [mcp-doctor](https://github.com/rustemmustafingovua-byte/mcp-doctor) | Monitoring | Health check for MCP servers: probes them, lists tools, classifies the failure |",
      "| [mcp-proxy](https://github.com/rustemmustafingovua-byte/mcp-proxy) | Monitoring | One endpoint in front of many MCP servers: client key, rate limits, logs, replay |",
      "",
      "All four are MIT, have CI on Node 20/22/24, ship a CLI and are published with tests. No account or API key is required for the free paths.",
    ].join("\n"),
  }
  const pr = await api("POST", `/repos/${UPSTREAM}/pulls`, body)
  if (pr.status === 201) {
    console.log(`\n  ✓ PR: ${pr.json.html_url}`)
    await api("POST", `/repos/${OWNER}/${fork}/pulls/${pr.json.number}/comments`, {
      body: "Added four MCP servers from the APInex toolkit. All MIT, tested, with CI. Please review the section placement — I can move any of them.",
    }).catch(() => {})
  } else {
    console.log(`\n  ✗ PR: ${pr.status} ${pr.text.slice(0, 300)}`)
  }
}

main()
