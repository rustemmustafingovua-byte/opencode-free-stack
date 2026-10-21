#!/usr/bin/env node
/**
 * bounty-hunt.mjs — охота за баунтами, за которые платят криптой.
 *
 * Источники: Algora ( escrow, платит за merged PR) и Opire ( то же).
 * Отбор жёсткий: задача открыта, баунт реально профинансирован (комментарий
 * бота платформы), по ней нет merged PR, и её не взял никто.
 *
 *   node scripts/bounty-hunt.mjs               # отчёт
 *   node scripts/bounty-hunt.mjs --attempt owner/repo#12   # оставить /attempt
 *
 * Отчёт: ~/.local/state/bounties.md
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

const STATE = join(homedir(), ".local", "state")
const REPORT = join(STATE, "bounties.md")
const SECRETS = join(homedir(), ".config", "opencode", "secrets")
const WALLET = "0x8aC6a229f254980CCd3Dd35CF5E1B7c08880B40E"

const token = () => {
  const f = join(SECRETS, "github.key")
  return existsSync(f) ? readFileSync(f, "utf8").trim() : ""
}
const H = () => ({
  Accept: "application/vnd.github+json",
  "User-Agent": "bounty-hunt",
  ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
})

const ok = (s) => `\x1b[32m${s}\x1b[0m`
const warn = (s) => `\x1b[33m${s}\x1b[0m`
const dim = (s) => `\x1b[2m${s}\x1b[0m`

const AMOUNTS = [1000, 500, 250, 200, 150, 100, 75, 50]

/** Algora-бот оставляет комментарий вида "💎 $100 bounty". */
function isFunded(comments) {
  return comments.some((c) => /bounty/i.test(c.body) && /\$\s?\d/.test(c.body) && /algora/i.test(c.user.login + c.body))
}

/** Кто-то уже взял задачу? */
function isClaimed(comments) {
  return comments.some((c) => /^\s*\/(attempt|claim)\b/im.test(c.body))
}

async function searchIssues(amount) {
  const q = `label:"$${amount}" is:open -label:"💎 Bounty" -label:"💰 Rewarded" archived:false`
  const res = await fetch(
    `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&sort=created&order=desc&per_page=12`,
    { headers: H() },
  )
  if (!res.ok) return []
  const j = await res.json()
  return (j.items || []).filter((i) => !i.pull_request)
}

async function inspect(issue) {
  const [owner, repo] = issue.repository_url.split("/repos/")[1].split("/")
  const commentsRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issue.number}/comments?per_page=100`,
    { headers: H() },
  )
  const comments = commentsRes.ok ? await commentsRes.json() : []
  // merged PR, который решает задачу
  const prsRes = await fetch(
    `https://api.github.com/search/issues?q=${encodeURIComponent(`repo:${owner}/${repo} is:pr is:merged "${issue.title.slice(0, 30)}"`)}`,
    { headers: H() },
  )
  const prs = prsRes.ok ? (await prsRes.json()).items?.length ?? 0 : 0
  const amountLabel = (issue.labels || []).find((l) => l.name.startsWith("$"))
  return {
    owner,
    repo,
    number: issue.number,
    title: issue.title,
    url: issue.html_url,
    amount: amountLabel ? Number(amountLabel.name.replace(/[^0-9.]/g, "")) : 0,
    funded: isFunded(comments),
    claimed: isClaimed(comments),
    mergedPrs: prs,
    created: issue.created_at.slice(0, 10),
    comments: comments.length,
  }
}

async function comment(repoFull, number, body) {
  const [owner, repo] = repoFull.split("/")
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${number}/comments`, {
    method: "POST",
    headers: { ...H(), "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  })
  const j = await res.json()
  if (!res.ok) throw new Error(j.message || `HTTP ${res.status}`)
  return j.html_url
}

const args = process.argv.slice(2)

if (args[0] === "--attempt") {
  const [repoFull, num] = (args[1] || "").split("#")
  const number = Number(num)
  try {
    const url = await comment(
      repoFull,
      number,
      `/attempt #${number}\n\nБерусь за задачу. План: разобраться с кодом, собрать PoC/тест, прислать PR. Платёж — на ${WALLET} (Base, USDC/ETH).`,
    )
    console.log(ok(`заявка оставлена: ${url}`))
  } catch (e) {
    console.log(warn(`не вышло: ${e.message}`))
  }
  process.exit(0)
}

// 1) собрать кандидатов по всем суммам
const seen = new Set()
const candidates = []
for (const amount of AMOUNTS) {
  const issues = await searchIssues(amount)
  for (const i of issues) {
    const key = i.html_url
    if (seen.has(key)) continue
    seen.add(key)
    candidates.push(await inspect(i))
  }
}

// 2) оставить только те, что реально профинансированы и не заняты
const targets = candidates
  .filter((c) => c.funded && !c.claimed && c.mergedPrs === 0)
  .sort((a, b) => b.amount - a.amount)

const lines = [
  "# Охота за баунтами (крипта, escrow)",
  "",
  `_${new Date().toISOString().slice(0, 16).replace("T", " ")} · Algora/Opire · выплата на ${WALLET}_`,
  "",
  targets.length
    ? "| Сумма | Задача | Возраст | Комм. | Ссылка |"
    : "",
  ...(targets.length
    ? [
        "|---|---|---|---|---|",
        ...targets.map(
          (t) => `| $${t.amount} | ${t.title.slice(0, 50)} | ${t.created} | ${t.comments} | ${t.url} |`,
        ),
      ]
    : ["_Сейчас подходящих задач нет — сканер запускается каждые 30 минут._"]),
  "",
]
mkdirSync(STATE, { recursive: true })
writeFileSync(REPORT, lines.join("\n"))

console.log(ok(`\nПроверено кандидатов: ${candidates.length} · подходящих: ${targets.length}\n`))
if (process.argv.includes("--debug")) {
  for (const c of candidates) {
    console.log(
      dim(
        `  $${String(c.amount).padStart(5)} ${c.funded ? "💰" : "  "} ${c.claimed ? "👤" : "  "} pr:${c.mergedPrs}  ${c.title.slice(0, 40)}  ${c.url}`,
      ),
    )
  }
}
for (const t of targets) {
  console.log(`  $${String(t.amount).padStart(5)}  ${t.title.slice(0, 44).padEnd(44)} ${t.created}  ${t.url}`)
}
if (!targets.length) {
  console.log(dim("\n  Ничего подходящего сейчас. Сканер продолжит проверять каждые 30 минут."))
}
console.log(dim(`\n  Отчёт: ${REPORT}`))
