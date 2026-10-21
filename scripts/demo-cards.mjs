#!/usr/bin/env node
/**
 * demo-cards.mjs — генерирует «демо-карточки» для README каждого проекта.
 *
 * Картинка рисуется из РЕАЛЬНОГО вывода команды (никаких выдуманных строк),
 * поэтому на картинке ровно то, что увидит человек.
 *
 *   node scripts/demo-cards.mjs             # все проекты
 *   node scripts/demo-cards.mjs free-web-mcp
 */
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

const WORKSPACE = join(homedir(), "workspace")
const OUT = join("/tmp", "demo-cards")
mkdirSync(OUT, { recursive: true })

/** Проект → команда, которую запускаем для реального вывода. */
const PROJECTS = {
  "free-web-mcp": {
    cmd: "node",
    args: ["bin/free-web-mcp.js", "--help"],
    title: "free-web-mcp",
    subtitle: "веб-поиск и чтение страниц без ключей и кредитов",
    accent: "#a371f7",
  },
  "agent-browser-mcp": {
    cmd: "node",
    args: ["bin/agent-browser-mcp.js", "--help"],
    title: "agent-browser-mcp",
    subtitle: "настоящий браузер для агента: навигация, клики, ввод, защитные экраны",
    accent: "#3fb950",
  },
  "lumen-chain": {
    cmd: "npx",
    args: ["tsx", "cli/lumen.ts", "explorer"],
    title: "lumen-chain",
    subtitle: "PoS-цепь со своим рынком: P2P gossip, AMM, keeper через Uniswap V3",
    accent: "#58a6ff",
  },
  "prompt-injection-guard": {
    cmd: "node",
    args: ["bin/prompt-injection-guard.js", "--help"],
    title: "prompt-injection-guard",
    subtitle: "находит инструкции, спрятанные там, где агент читает сам",
    accent: "#f85149",
  },
  "agent-cost-guard": {
    cmd: "node",
    args: ["bin/agent-cost-guard.js", "--help"],
    title: "agent-cost-guard",
    subtitle: "бюджет перед любым OpenAI-совместимым эндпоинтом",
    accent: "#d29922",
  },
  "mcp-doctor": {
    cmd: "node",
    args: ["bin/mcp-doctor.js", "--help"],
    title: "mcp-doctor",
    subtitle: "диагностика MCP-серверов: спавн, хендшейк, таймаут, авторизация",
    accent: "#39c5cf",
  },
  "wallet-hygiene": {
    cmd: "node",
    args: ["bin/wallet-hygiene.js", "--help"],
    title: "wallet-hygiene",
    subtitle: "контроль над своими кошельками: утечки ключей и забытые адреса",
    accent: "#8b949e",
  },
  "agent-x402": {
    cmd: "node",
    args: ["bin/agent-x402.js", "--help"],
    title: "agent-x402",
    subtitle: "платежи за API в USDC на Base: без аккаунта и без ключа, с лимитом расходов",
    accent: "#39c5cf",
  },
  "mcp-proxy": {
    cmd: "node",
    args: ["bin/mcp-proxy.js", "--help"],
    title: "mcp-proxy",
    subtitle: "один эндпоинт перед многими MCP: ключ, лимиты, журнал запросов",
    accent: "#bc8cff",
  },
  "opencode-doctor": {
    cmd: "node",
    args: ["bin/opencode-doctor.js", "--help"],
    title: "opencode-doctor",
    subtitle: "аудит установки OpenCode одной командой",
    accent: "#d29922",
  },
  "free-tier-tracker": {
    cmd: "node",
    args: ["bin/free-tier-tracker.js", "--help"],
    title: "free-tier-tracker",
    subtitle: "сколько квоты осталось — до того, как модель упадёт с 402",
    accent: "#8b949e",
  },
  "x402-priceboard": {
    cmd: "node",
    args: ["bin/x402-priceboard.js", "--help"],
    title: "x402-priceboard",
    subtitle: "прайс-лист x402-эндпоинтов, без единой траты",
    accent: "#58a6ff",
  },
  "opencode-free-stack": {
    cmd: "node",
    args: ["bin/opencode-free-stack.js", "--help"],
    title: "opencode-free-stack",
    subtitle: "роутер free-моделей с авто-фолбэком по квотам и RPM",
    accent: "#3fb950",
  },
  "tool-schema-lint": {
    cmd: "node",
    args: ["bin/tool-schema-lint.js", "--help"],
    title: "tool-schema-lint",
    subtitle: "ловит схемы инструментов, из-за которых модель вызывает не то",
    accent: "#bc8cff",
  },
}

function runOutput(dir, spec) {
  try {
    return execFileSync(spec.cmd, spec.args, {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60000,
      maxBuffer: 4 * 1024 * 1024,
    })
      .split("\n")
      .filter((l) => l.trim())
      .slice(0, 12)
      .join("\n")
  } catch (e) {
    const out = `${e.stdout ?? ""}${e.stderr ?? ""}`
    return (
      out
        .split("\n")
        .filter((l) => l.trim())
        .slice(0, 12)
        .join("\n") || `${spec.cmd} ${spec.args.join(" ")}`
    )
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c])
}

function cardHtml(spec, output) {
  const lines = output
    .split("\n")
    .map(
      (l) =>
        `<span class="l">${escapeHtml(l)
          .replace(/(--[a-z-]+)/g, '<b class="o">$1</b>')
          .replace(/\b(\d[\d.,]*)\b/g, '<b class="n">$1</b>')
          .slice(0, 118)}</span>`,
    )
    .join("")
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}
  body{margin:0;width:1200px;height:630px;background:
    radial-gradient(900px 520px at 8% -12%, ${spec.accent}33, transparent 58%),
    radial-gradient(760px 460px at 96% 108%, #3fb95022, transparent 55%),#0a0c10;
    color:#e6edf3;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif;padding:44px 52px;display:flex;flex-direction:column}
  .top{display:flex;align-items:flex-start;gap:16px;margin-bottom:22px}
  .dot{width:12px;height:12px;border-radius:50%;background:#ff5f57;box-shadow:20px 0 0 #febc2e,40px 0 0 #28c840;margin-bottom:6px}
  h1{margin:0 0 6px;font-size:31px;letter-spacing:-.02em}
  .sub{margin:0;color:#8b949e;font-size:16.5px}
  .term{background:#0b0e13;border:1px solid #232a33;border-radius:13px;padding:18px 20px;font:13.5px/1.62 ui-monospace,SFMono-Regular,Menlo,monospace;
    box-shadow:0 24px 60px rgba(0,0,0,.45);flex:1;overflow:hidden}
  .l{display:block;white-space:pre;overflow:hidden;text-overflow:ellipsis;color:#adbac7}
  .l::before{content:"$ ";color:#6e7681}
  .o{color:#79c0ff;font-weight:600}.n{color:#d2a8ff}
  .foot{margin-top:16px;color:#6e7681;font-size:13.5px}
  .foot b{color:#8b949e;font-weight:600}
</style></head><body>
  <div class="top"><div><h1>${escapeHtml(spec.title)}</h1><p class="sub">${escapeHtml(spec.subtitle)}</p></div></div>
  <div class="term"><div class="dot"></div>${lines}</div>
  <div class="foot">github.com/${"rustemmustafingovua-byte"}/${escapeHtml(spec.title)} · MIT</div>
</body></html>`
}

const only = process.argv.slice(2)
const targets = only.length ? only : Object.keys(PROJECTS)

for (const slug of targets) {
  const spec = PROJECTS[slug]
  if (!spec) continue
  const dir = join(WORKSPACE, slug)
  if (!existsSync(join(dir, "package.json"))) {
    console.log(`  пропущен ${slug}: нет пакета`)
    continue
  }
  const output = runOutput(dir, spec)
  const html = cardHtml(spec, output)
  const htmlFile = join(OUT, `${slug}.html`)
  writeFileSync(htmlFile, html)
  const png = join(dir, "docs", "social-preview.png")
  mkdirSync(join(dir, "docs"), { recursive: true })
  try {
    execFileSync(
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
      [
        "--headless",
        "--disable-gpu",
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
        `--screenshot=${png}`,
        "--window-size=1200,630",
        `file://${htmlFile}`,
      ],
      { stdio: "ignore", timeout: 60000 },
    )
    console.log(`  ✓ ${slug} → ${png.replace(WORKSPACE + "/", "")}`)
  } catch (e) {
    console.log(`  ✗ ${slug}: ${String(e.message).slice(0, 80)}`)
  }
}
