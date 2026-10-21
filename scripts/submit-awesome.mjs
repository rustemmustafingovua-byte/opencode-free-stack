#!/usr/bin/env node
/**
 * submit-awesome.mjs — бесплатная дистрибуция: наши MCP-серверы в чужих
 * awesome-списках.
 *
 * Каждый такой список — это тысячи звёзд и постоянный поток посетителей.
 * Стоит ноль денег: только PR.
 *
 *   node scripts/submit-awesome.mjs           # все списки
 *   node scripts/submit-awesome.mjs --dry     # только показать, что добавим
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

/** Списки и куда в них наши серверы. */
const TARGETS = [
  {
    repo: "appcypher/awesome-mcp-servers",
    branch: "main",
    file: "README.md",
    section: "Search & Web",
    sectionHint: "## ",
    entries: [
      {
        icon: '<img src="https://cdn.simpleicons.org/brave/FB542B" height="14"/>',
        name: "free-web-mcp",
        url: "https://github.com/rustemmustafingovua-byte/free-web-mcp",
        desc: "Web search and page reading for AI agents with zero API credits - r.jina.ai renders any page to markdown, plus Wikipedia, Hacker News and GitHub search behind one MCP server - no key, no credit card, no metered calls. Free tier 30 req/hour, paid tier 0.001 USDC per call via x402.",
        after: "Fetch",
      },
      {
        icon: '<img src="https://cdn.simpleicons.org/puppeteer/00D8A2" height="14"/>',
        name: "agent-browser-mcp",
        url: "https://github.com/rustemmustafingovua-byte/agent-browser-mcp",
        desc: "A real browser for AI agents - navigation, reading, clicking, typing - with Cloudflare and captcha handling under an explicit budget and domain allowlist. Uses the browser already installed on the machine.",
        after: "Bright Data",
      },
    ],
  },
  {
    repo: "wong2/awesome-mcp-servers",
    branch: "main",
    file: "README.md",
    section: "Community Servers",
    entries: [
      {
        icon: "",
        name: "free-web-mcp",
        url: "https://github.com/rustemmustafingovua-byte/free-web-mcp",
        desc: "Web search and page reading for AI agents with zero API credits - no key, no credit card, no metered calls",
        after: "exa",
      },
    ],
  },
]

process.on("unhandledRejection", (e) => {
  console.error("ОШИБКА:", e?.message ?? e)
  if (e?.stderr) console.error(String(e.stderr).slice(0, 400))
  process.exit(1)
})

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
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status} ${(json?.message || text).slice(0, 160)}`)
  }
  return json
}

function line(entry) {
  return `- ${entry.icon ? entry.icon + " " : ""}[${entry.name}](${entry.url}) - ${entry.desc}`
}

for (const t of TARGETS) {
  console.log(`\n=== ${t.repo} ===`)
  const repoName = t.repo.split("/")[1]
  const work = join("/tmp", `awesome-${repoName}-${process.pid}`)
  rmSync(work, { recursive: true, force: true })
  mkdirSync(work, { recursive: true })

  // форк с уникальным именем (один форк на несколько списков нельзя)
  const suffix = t.repo.split("/")[0].replace(/[^a-z0-9]/gi, "")
  const forkName = `${repoName}-${suffix}`.toLowerCase()
  // для punkpeye форк уже называется так — не переименовываем
  let fork = null
  try {
    fork = await api("GET", `/repos/${OWNER}/${forkName}`)
  } catch {}
  if (!fork) {
    console.log(`  форка ${forkName} нет — создаю`)
    if (dry) continue
    await api("POST", `/repos/${t.repo}/forks`, {})
    // форк появляется не сразу; переименовываем, если имя занято другим родителем
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1500))
      try {
        const f = await api("GET", `/repos/${OWNER}/${repoName}`)
        if (f) {
          await api("PATCH", `/repos/${OWNER}/${repoName}`, { name: forkName })
          break
        }
      } catch {}
    }
  }

  // клон
  const cloneUrl = `https://x-access-token:${TOKEN}@github.com/${OWNER}/${forkName}.git`
  try {
    execFileSync("git", ["clone", "--depth", "1", cloneUrl, work], { stdio: ["ignore", "ignore", "pipe"] })
  } catch (e) {
    console.log(`  клон не удался: ${String(e.message).slice(0, 120)}`)
    continue
  }

  const file = join(work, t.file)
  if (!existsSync(file)) {
    console.log("  файла нет:", t.file)
    continue
  }
  let content = readFileSync(file, "utf8")
  const lines = content.split("\n")

  // находим секцию: заголовок, содержащий нужную фразу
  let start = lines.findIndex((l) => l.startsWith("## ") && l.includes(t.section))
  if (start < 0) {
    console.log("  секция не найдена:", t.section)
    continue
  }
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      end = i
      break
    }
  }

  let added = 0
  for (const entry of t.entries) {
    if (content.includes(`[${entry.name}](${entry.url})`)) {
      console.log(`  ${entry.name}: уже есть`)
      continue
    }
    // вставляем после указанной записи, иначе в конец секции
    let insertAt = end - 1
    for (let i = start + 1; i < end; i++) {
      if (lines[i].includes(`[${entry.after}]`)) {
        insertAt = i + 1
        break
      }
    }
    lines.splice(insertAt, 0, line(entry))
    end += 1
    added++
    console.log(`  ${entry.name}: добавлен`)
  }

  if (!added) {
    console.log("  добавлять нечего")
    continue
  }
  if (dry) continue

  writeFileSync(file, lines.join("\n"))
  const branch = `add/${OWNER}-mcp-servers`
  const sh = (cmd, args) => execFileSync("git", ["-C", work, cmd, ...args], { stdio: ["ignore", "pipe", "pipe"] })
  sh("checkout", ["-B", branch])
  sh("config", ["user.name", OWNER])
  sh("config", ["user.email", `${OWNER}@users.noreply.github.com`])
  sh("add", [t.file])
  sh("commit", ["-m", `Add ${OWNER} MCP servers to the list`])
  sh("push", ["--force", "origin", branch])

  const pr = await api("POST", `/repos/${t.repo}/pulls`, {
    title: `Add ${OWNER} MCP servers`,
    head: `${OWNER}:${branch}`,
    base: t.branch,
    body: [
      `Adds three MIT MCP servers from ${OWNER}:`,
      "",
      "- **free-web-mcp** - web search and page reading for AI agents with zero API credits (no key, no credit card). Free tier 30 requests/hour, paid tier 0.001 USDC per call over x402.",
      "- **agent-browser-mcp** - a real browser for agents with Cloudflare/captcha handling under an explicit budget and domain allowlist.",
      "- **agent-x402** - pay per API call in USDC on Base with a spend policy enforced outside the model.",
      "",
      "All are open source, tested, and published to the official MCP registry.",
    ].join("\n"),
  })
  console.log(`  PR: ${pr.html_url}`)
}
