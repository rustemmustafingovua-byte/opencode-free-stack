#!/usr/bin/env node
/**
 * status-page.mjs — живая страница статуса портфеля.
 *
 * Собирает по каждому репозиторию: звёзды, issues, последний релиз, статус CI,
 * версию в GitHub Packages, живые сервисы — и генерирует status.html + STATUS.md.
 *
 *   node scripts/status-page.mjs            # собрать и записать
 *   node scripts/status-page.mjs --check    # только показать в консоли
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

const WORKSPACE = join(homedir(), "workspace")
const PROFILE = join(WORKSPACE, "profile-readme")
const SECRETS = join(homedir(), ".config", "opencode", "secrets")
const OWNER = "rustemmustafingovua-byte"

const REPOS = [
  { slug: "opencode-free-stack", desc: "Роутер free-моделей с авто-фолбэком по квотам и RPM", group: "Агенты" },
  { slug: "free-web-mcp", desc: "Веб-поиск и чтение страниц без ключей и кредитов — есть в официальном MCP Registry", group: "MCP" },
  { slug: "agent-x402", desc: "Платежи за API в USDC на Base с лимитом расходов вне модели", group: "MCP" },
  { slug: "mcp-doctor", desc: "Диагностика MCP-серверов: спавн, хендшейк, таймаут, авторизация", group: "MCP" },
  { slug: "mcp-proxy", desc: "Один эндпоинт перед многими MCP: ключ, лимиты, журнал, повтор запросов", group: "MCP" },
  { slug: "tool-schema-lint", desc: "Линтер схем инструментов: то, из-за чего модель вызывает не то", group: "Качество" },
  { slug: "prompt-budget", desc: "Сколько токенов стоит запрос и сколько съедает контекст", group: "Контроль затрат" },
  { slug: "agent-cost-guard", desc: "Бюджет перед любым OpenAI-совместимым эндпоинтом", group: "Контроль затрат" },
  { slug: "opencode-doctor", desc: "Аудит установки OpenCode одной командой", group: "Качество" },
  { slug: "free-tier-tracker", desc: "Квота free-тарифов: сколько осталось до конца", group: "Контроль затрат" },
  { slug: "x402-priceboard", desc: "Прайс-лист x402-эндпоинтов, без траты денег", group: "Контроль затрат" },
  { slug: "prompt-injection-guard", desc: "Поиск инструкций, спрятанных в файлах, которые читает агент", group: "Безопасность" },
  { slug: "readme-doctor", desc: "Почему никто не пользуется репозиторием — и что поправить", group: "Качество" },
  { slug: "wallet-hygiene", desc: "Контроль над своими кошельками: утечки ключей, забытые адреса, сбор средств на основной", group: "Безопасность" },
  { slug: "agent-browser-mcp", desc: "Настоящий браузер для агента: навигация, чтение, клики — с обходом защитных экранов по бюджету", group: "MCP" },
  { slug: "lumen-chain", desc: "PoS-цепь со своим рынком: P2P gossip, AMM, keeper через Uniswap V3", group: "Lumen" },
]

const SERVICES = [
  {
    name: "free-web-mcp",
    desc: "публичный MCP по HTTP (streamable-http)",
    urlFile: join(homedir(), ".local/state/free-web-url.txt"),
    probe: "/health",
  },
  {
    name: "Lumen Explorer",
    desc: "живая цепочка: блоки, счета, пулы AMM",
    urlFile: join(homedir(), ".local/state/lumen-url.txt"),
    probe: "/api/state",
  },
]

const token = () => {
  const f = join(SECRETS, "github.key")
  return existsSync(f) ? readFileSync(f, "utf8").trim() : ""
}

const H = () => ({
  Accept: "application/vnd.github+json",
  ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
})

async function gh(path) {
  try {
    const res = await fetch(`https://api.github.com${path}`, { headers: H() })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function collect() {
  const rows = []
  for (const r of REPOS) {
    const repo = await gh(`/repos/${OWNER}/${r.slug}`)
    const runs = await gh(`/repos/${OWNER}/${r.slug}/actions/runs?per_page=6`)
    const rel = await gh(`/repos/${OWNER}/${r.slug}/releases/latest`)
    const pkg = await gh(`/repos/${OWNER}/${r.slug}/contents/package.json`)
    let version = null
    if (pkg?.content) {
      try {
        version = JSON.parse(Buffer.from(pkg.content, "base64").toString()).version ?? null
      } catch {}
    }
    const issues = await gh(`/repos/${OWNER}/${r.slug}/issues?state=open&per_page=50`)
    const open = (issues || []).filter((i) => !i.pull_request).length
    // смотрим только последний прогон каждого воркфлоу: старые падения не важны
    const latest = new Map()
    for (const w of runs?.workflow_runs || []) if (!latest.has(w.name)) latest.set(w.name, w)
    const failed = [...latest.values()].filter(
      (w) => w.conclusion === "failure" || (w.conclusion === "cancelled" && w.name !== "Docs"),
    ).length
    rows.push({
      ...r,
      stars: repo?.stargazers_count ?? 0,
      forks: repo?.forks_count ?? 0,
      open,
      version,
      release: rel?.tag_name ?? null,
      ci: failed === 0 ? "ok" : "fail",
      pushed: (repo?.pushed_at || "").slice(0, 10),
    })
  }

  const services = []
  for (const s of SERVICES) {
    let url = ""
    let up = false
    if (existsSync(s.urlFile)) {
      url = readFileSync(s.urlFile, "utf8").trim()
      if (url) {
        try {
          const res = await fetch(url + s.probe, { signal: AbortSignal.timeout(12000) })
          up = res.ok
        } catch {
          up = false
        }
      }
    }
    services.push({ ...s, url, up })
  }
  return { rows, services }
}

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]))

function renderHtml({ rows, services }) {
  const groups = {}
  for (const r of rows) (groups[r.group] ??= []).push(r)
  const groupHtml = Object.entries(groups)
    .map(
      ([group, items]) => `<h2>${esc(group)}</h2>
  <table><thead><tr><th>Проект</th><th>Версия</th><th>CI</th><th>★</th><th>Issues</th><th>Релиз</th></tr></thead><tbody>
${items
  .map(
    (r) => `<tr>
    <td><a href="https://github.com/${OWNER}/${r.slug}">${esc(r.slug)}</a><br><span class="d">${esc(r.desc)}</span></td>
    <td class="mono">${esc(r.version || "—")}</td>
    <td class="${r.ci === "ok" ? "ok" : "bad"}">${r.ci === "ok" ? "зелёный" : "провал"}</td>
    <td>${r.stars}</td>
    <td>${r.open}</td>
    <td class="mono">${esc(r.release || "—")}</td>
  </tr>`,
  )
  .join("\n")}
</tbody></table>`,
    )
    .join("\n")

  const svcHtml = services
    .map(
      (s) => `<div class="card ${s.up ? "ok" : "bad"}">
    <b>${esc(s.name)}</b>
    <p>${esc(s.desc)}</p>
    <p class="mono">${s.up ? `<a href="${esc(s.url)}">${esc(s.url)}</a>` : "недоступен"}</p>
  </div>`,
    )
    .join("\n")

  const totalStars = rows.reduce((a, r) => a + r.stars, 0)
  const green = rows.filter((r) => r.ci === "ok").length

  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Статус портфеля — ${esc(OWNER)}</title>
<style>
  :root{--bg:#08090c;--panel:#0e1116;--line:#1d222a;--fg:#e6edf3;--muted:#8b949e;--accent:#a371f7;--ok:#3fb950;--bad:#f85149}
  *{box-sizing:border-box}
  body{margin:0;background:radial-gradient(900px 500px at 10% -10%,rgba(163,113,247,.13),transparent 60%),var(--bg);color:var(--fg);font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif}
  .wrap{max-width:1080px;margin:0 auto;padding:56px 22px 90px}
  h1{font-size:30px;margin:0 0 6px;letter-spacing:-.02em}
  .sub{color:var(--muted);margin:0 0 8px}
  .pill{display:inline-block;font-size:12px;padding:3px 10px;border-radius:999px;background:rgba(63,185,80,.14);border:1px solid rgba(63,185,80,.4);color:var(--ok);margin-bottom:22px}
  h2{font-size:13px;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin:36px 0 10px}
  table{width:100%;border-collapse:collapse;font-size:13.5px}
  th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}
  th{color:var(--muted);font-weight:600;font-size:11.5px;text-transform:uppercase;letter-spacing:.04em}
  tr:hover td{background:rgba(163,113,247,.05)}
  a{color:var(--accent);text-decoration:none}
  a:hover{text-decoration:underline}
  .d{color:var(--muted);font-size:12.5px}
  .mono{font-family:ui-monospace,Menlo,monospace;font-size:12.5px}
  .ok{color:var(--ok)} .bad{color:var(--bad)}
  .grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
  .card{border:1px solid var(--line);border-radius:12px;padding:14px 16px;background:var(--panel)}
  .card.ok{border-color:rgba(63,185,80,.35)} .card.bad{border-color:rgba(248,81,73,.35)}
  .card b{display:block;margin-bottom:4px} .card p{margin:4px 0;color:var(--muted);font-size:13px}
  .sum{display:flex;gap:22px;flex-wrap:wrap;margin:18px 0 6px}
  .sum div b{display:block;font-size:24px} .sum div span{color:var(--muted);font-size:12.5px}
  footer{margin-top:44px;padding-top:18px;border-top:1px solid var(--line);color:#6e7681;font-size:13px}
  pre{background:#11161d;border:1px solid var(--line);border-radius:12px;padding:14px 16px;overflow:auto;font:13px/1.6 ui-monospace,Menlo,monospace}
</style></head><body><div class="wrap">
<h1>Статус портфеля</h1>
<p class="sub">Живая сводка по ${rows.length} проектам: версии, CI, релизы и работающие сервисы.</p>
<span class="pill">обновлено ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC</span>
<div class="sum">
  <div><b>${totalStars}</b><span>звёзд суммарно</span></div>
  <div><b class="${green === rows.length ? "ok" : "bad"}">${green}/${rows.length}</b><span>репозиториев с зелёным CI</span></div>
  <div><b>${services.filter((s) => s.up).length}/${services.length}</b><span>живых сервисов</span></div>
</div>
<h2>Живые сервисы</h2>
<div class="grid">${svcHtml}</div>
${groupHtml}
<h2>Установка всего набора</h2>
<pre><code>curl -fsSL https://raw.githubusercontent.com/${OWNER}/opencode-free-stack/main/install.sh | bash</code></pre>
<footer>${esc(OWNER)} · MIT · <a href="https://github.com/${OWNER}">профиль</a> · <a href="https://github.com/${OWNER}/${OWNER}">витрина</a></footer>
</div></body></html>`
}

function renderMarkdown({ rows, services }) {
  const lines = [
    "# Статус портфеля",
    "",
    `_Обновлено: ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC_`,
    "",
    "| Проект | Версия | CI | ★ | Issues | Релиз |",
    "|---|---|---|---|---|---|",
  ]
  for (const r of rows) {
    lines.push(
      `| [${r.slug}](https://github.com/${OWNER}/${r.slug}) | ${r.version || "—"} | ${r.ci === "ok" ? "🟢" : "🔴"} | ${r.stars} | ${r.open} | ${r.release || "—"} |`,
    )
  }
  lines.push("", "## Сервисы", "")
  for (const s of services) {
    lines.push(`- **${s.name}** — ${s.up ? `🟢 ${s.url}` : "🔴 недоступен"} (${s.desc})`)
  }
  lines.push("")
  return lines.join("\n")
}

const args = process.argv.slice(2)
const data = await collect()
if (args.includes("--check")) {
  for (const r of data.rows) {
    console.log(`${r.slug.padEnd(22)} v${String(r.version).padEnd(8)} CI:${r.ci} ★${r.stars} issues:${r.open}`)
  }
  for (const s of data.services) console.log(`${s.name.padEnd(22)} ${s.up ? "up" : "DOWN"} ${s.url}`)
  process.exit(0)
}

writeFileSync(join(PROFILE, "docs", "status.html"), renderHtml(data))
writeFileSync(join(PROFILE, "STATUS.md"), renderMarkdown(data))
console.log("status.html и STATUS.md обновлены")
