#!/usr/bin/env node
/**
 * bounty-watch.mjs — автоматический охотник за оплаченными баунтами.
 *
 * Opire держит деньги в эскроу: платит заказчик, исполнителю ничего не нужно.
 * Наша задача — не пропускать новые: скрипт находит открытые баунты, проверяет
 * по GitHub, что задача ещё не занята, и (по флагу) оставляет заявку `/try`.
 *
 *   node scripts/bounty-watch.mjs            # собрать отчёт
 *   node scripts/bounty-watch.mjs --claim owner/repo#12   # оставить заявку
 *
 * Отчёт пишется в ~/.local/state/bounties.md
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

const STATE = join(homedir(), ".local", "state")
const REPORT = join(STATE, "bounties.md")
const SECRETS = join(homedir(), ".config", "opencode", "secrets")
const token = () => {
  const f = join(SECRETS, "github.key")
  return existsSync(f) ? readFileSync(f, "utf8").trim() : ""
}
const H = () => ({
  Accept: "application/vnd.github+json",
  ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
})

const ok = (s) => `\x1b[32m${s}\x1b[0m`
const dim = (s) => `\x1b[2m${s}\x1b[0m`
const warn = (s) => `\x1b[33m${s}\x1b[0m`

/** Разбор страницы Opire: строки вида "owner | repo | дата | title | языки | $amount | tries | solvers". */
export function parseOpire(text) {
  const rows = []
  const lines = text.split("\n").map((l) => l.trim())
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\$([\d,.]+)$/)
    if (!m) continue
    // ищем владельца/репозиторий выше
    let owner = null
    let repo = null
    let title = null
    for (let j = i - 1; j >= Math.max(0, i - 6); j--) {
      const l = lines[j]
      if (!l || /Coins|Partner|Command available|Views|Earnable|Available/i.test(l)) continue
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(l) && j > 0) {
        owner = lines[j - 1]
        repo = lines[j - 2]
        title = lines[j + 1]
        break
      }
    }
    if (!owner || !repo) continue
    const amount = Number(m[1].replace(/,/g, ""))
    const tries = lines[i + 1] ?? ""
    const solvers = lines[i + 2] ?? ""
    rows.push({
      owner,
      repo,
      title: title ?? "",
      amount,
      languages: lines[i - 3] ?? "",
      tries,
      solvers,
      unclaimed: /^\+?\d*$/.test(tries.trim()) || /0 solvers/.test(solvers),
    })
  }
  return rows
}

/** Найти issue по репозиторию и заголовку. */
async function findIssue(owner, repo, title) {
  const url = `https://api.github.com/search/issues?q=${encodeURIComponent(`repo:${owner}/${repo} in:title "${title.slice(0, 40)}"`)}`
  const res = await fetch(url, { headers: H() })
  if (!res.ok) return null
  const j = await res.json()
  const items = (j.items || []).filter((i) => !i.pull_request)
  if (!items.length) return null
  const exact = items.find((i) => i.title.toLowerCase() === title.toLowerCase()) ?? items[0]
  return { number: exact.number, state: exact.state, title: exact.title, url: exact.html_url, comments: exact.comments }
}

/** Оставить заявку по протоколу Opire. */
async function claim(owner, repo, number) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${number}/comments`, {
    method: "POST",
    headers: { ...H(), "Content-Type": "application/json" },
    body: JSON.stringify({
      body: "/try\n\nИсполняю задачу. План: разобраться с кодом, собрать PoC и прислать PR с проверкой. Сроки — в пределах суток.\n\n---\n🤖 opencode (rustemmustafingovua-byte)",
    }),
  })
  const j = await res.json()
  if (!res.ok) throw new Error(j.message || `HTTP ${res.status}`)
  return j.html_url
}

const args = process.argv.slice(2)

// 1) собрать список с Opire
const res = await fetch("https://app.opire.dev/", { headers: { "user-agent": "bounty-watch" } })
const html = await res.text()
const text = html
  .replace(/<script[\s\S]*?<\/script>/g, " ")
  .replace(/<style[\s\S]*?<\/style>/g, " ")
  .replace(/<[^>]+>/g, "\n")
  .replace(/&amp;/g, "&")
  .replace(/&#x27;/g, "'")
  .replace(/&quot;/g, '"')
const rows = parseOpire(text)

if (args[0] === "--claim") {
  const [repoFull, num] = (args[1] || "").split("#")
  const [owner, repo] = repoFull.split("/")
  try {
    const url = await claim(owner, repo, num)
    console.log(ok(`заявка оставлена: ${url}`))
  } catch (e) {
    console.log(bad(`не вышло: ${e.message}`))
  }
  process.exit(0)
}

// 2) проверить по GitHub и собрать отчёт
const results = []
for (const r of rows) {
  const issue = await findIssue(r.owner, r.repo, r.title)
  if (!issue) continue
  if (issue.state !== "open") continue
  results.push({ ...r, ...issue })
}

results.sort((a, b) => b.amount - a.amount)

const lines = [
  "# Оплаченные баунты",
  "",
  `_${new Date().toISOString().slice(0, 16).replace("T", " ")} · источник: Opire (escrow) + GitHub_`,
  "",
  "| Сумма | Задача | Кто | Языки | Кто пытался | Ссылка |",
  "|---|---|---|---|---|---|",
  ...results.map(
    (r) =>
      `| $${r.amount.toFixed(2)} | ${r.title.slice(0, 52)} | ${r.owner}/${r.repo} | ${(r.languages || "").slice(0, 26)} | ${r.solvers || "—"} | ${r.url} |`,
  ),
  "",
]
mkdirSync(STATE, { recursive: true })
writeFileSync(REPORT, lines.join("\n"))

console.log(ok(`\nНайдено баунтов: ${results.length} → ${REPORT}\n`))
for (const r of results) {
  const flag = /0 solvers/.test(r.solvers || "") ? ok("свободен") : warn("занят")
  console.log(`  $${String(r.amount).padStart(6)}  ${r.title.slice(0, 46).padEnd(46)} ${flag}  ${r.url}`)
}
console.log(dim("\n  Занятость: «0 solvers» — заявку ещё никто не оставил."))
