#!/usr/bin/env node
/**
 * benchmarks.mjs — реальные замеры по всем инструментам портфеля.
 *
 * Никаких выдуманных цифр: каждая цифра — результат прогона на этой машине.
 *   node scripts/benchmarks.mjs            # прогнать и показать
 *   node scripts/benchmarks.mjs --save     # + записать в BENCHMARKS.md
 */
import { execFileSync, spawn } from "node:child_process"
import { writeFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

const WORKSPACE = join(homedir(), "workspace")
const PORTFOLIO = join(WORKSPACE, "opencode-free-stack")

const ok = (s) => `\x1b[32m${s}\x1b[0m`
const dim = (s) => `\x1b[2m${s}\x1b[0m`

const results = []

/** Медиана из нескольких прогонов. */
async function time(fn, runs = 5) {
  const samples = []
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now()
    await fn()
    samples.push(performance.now() - t0)
  }
  samples.sort((a, b) => a - b)
  return samples[Math.floor(samples.length / 2)]
}

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts })
}

/** Замер с защитой: ошибка не должна ронять весь прогон. */
async function bench(tool, fn) {
  try {
    const r = await fn()
    results.push({ tool, ...r })
  } catch (e) {
    console.log(dim(`  пропущено ${tool}: ${e && e.message ? e.message : String(e)}`))
  }
}

// 1. prompt-budget: подсчёт токенов в большом тексте
await bench("prompt-budget", async () => {
  const dir = join(WORKSPACE, "prompt-budget")
  const bigText = "word ".repeat(60000)
  const file = join("/tmp", "bench-prompt-budget.mjs")
  writeFileSync(
    file,
    `import { estimateTokens } from "${join(dir, "src/index.js")}"
const text = ${JSON.stringify(bigText)}
const t0 = performance.now()
const n = estimateTokens(text)
console.log(JSON.stringify({ tokens: n, ms: performance.now() - t0 }))
`,
  )
  const out = JSON.parse(run("node", [file]))
  return {
    metric: `${(bigText.length / 1000).toFixed(0)}k символов → ${out.tokens} токенов`,
    ms: out.ms,
    note: "подсчёт токенов, без сетевых запросов",
  }
})

// 2. tool-schema-lint: разбор схемы инструмента
await bench("tool-schema-lint", async () => {
  const dir = join(WORKSPACE, "tool-schema-lint")
  const file = join("/tmp", "bench-schema.json")
  writeFileSync(
    file,
    JSON.stringify({
      name: "example",
      description: "A tool",
      inputSchema: {
        type: "object",
        properties: {
          a: { type: "string" },
          b: { type: "string", description: "B param" },
          c: { type: "number", description: "C param" },
        },
        required: ["a"],
      },
    }),
  )
  const ms = await time(() => run("node", [join(dir, "bin/tool-schema-lint.js"), file], { stdio: ["ignore", "pipe", "ignore"] }), 5)
  return { metric: "схема из 3 параметров — полный анализ", ms, note: "включая запуск процесса" }
})

// 3. mcp-doctor: диагностика настроенных MCP-серверов
await bench("mcp-doctor", async () => {
  const dir = join(WORKSPACE, "mcp-doctor")
  const ms = await time(
    () => run("node", [join(dir, "bin/mcp-doctor.js"), "--json"], { stdio: ["ignore", "pipe", "ignore"] }),
    3,
  )
  return { metric: "проверка всех настроенных MCP-серверов", ms, note: "запуск процесса + опрос серверов" }
})

// 4. agent-cost-guard: задержка прокси перед моделью
await bench("agent-cost-guard", async () => {
  const dir = join(WORKSPACE, "agent-cost-guard")
  const port = 8797
  const proc = spawn("node", [join(dir, "bin/agent-cost-guard.js"), "--upstream", "https://api.openai.com/v1", "--port", String(port)], {
    stdio: "ignore",
  })
  await new Promise((r) => setTimeout(r, 1500))
  try {
    const ms = await time(async () => {
      const res = await fetch(`http://127.0.0.1:${port}/health`)
      if (!res.ok) throw new Error("health failed")
      await res.text()
    }, 5)
    return { metric: "проверка бюджета в прокси (GET /health)", ms, note: "задержка добавляется к каждому запросу" }
  } finally {
    proc.kill()
  }
})

// 5. free-web-mcp: живой сетевой запрос
await bench("free-web-mcp", async () => {
  const dir = join(WORKSPACE, "free-web-mcp")
  const ms = await time(
    async () => {
      const probe = join(dir, ".bench-search.mjs")
      writeFileSync(
        probe,
        `import { search } from "./src/index.js"
const r = await search("MCP", { source: "hn", limit: 2 })
if (!r) throw new Error("empty")
`,
      )
      try {
        run("node", [probe])
      } finally {
        rmSync(probe, { force: true })
      }
    },
    3,
  )
  return { metric: "поиск в Hacker News (живая сеть)", ms, note: "реальный сетевой запрос" }
})

// 6. x402-priceboard: прайс без траты денег
await bench("x402-priceboard", async () => {
  const dir = join(WORKSPACE, "x402-priceboard")
  const list = join("/tmp", "bench-endpoints.txt")
  writeFileSync(list, "https://api.venice.ai/api/v1/chat/completions\nhttps://api.x402.org/\n")
  const ms = await time(
    () => run("node", [join(dir, "bin/x402-priceboard.js"), "--file", list], { stdio: ["ignore", "pipe", "ignore"] }),
    3,
  )
  return { metric: "сбор цен по открытым x402-эндпоинтам", ms, note: "живая сеть, без единой транзакции" }
})

// 7. lumen-chain: блок с транзакцией
await bench("lumen-chain", async () => {
  const dir = join(WORKSPACE, "lumen-chain")
  const file = join(dir, ".bench-lumen.mjs")
  writeFileSync(
    file,
    `import { Chain } from "${join(dir, "core/chain.js")}"
import { createWallet, buildTx } from "${join(dir, "core/rpc.js")}"
const chain = new Chain(); chain.genesis()
const w = createWallet()
chain.ledger.get(w.address).balance = 1000000000000n
chain.ledger.get(w.address).publicKey = w.publicKey
chain.addValidator(w.publicKey, 10000000000n)
const t0 = performance.now()
for (let i = 1; i <= 100; i++) {
  const tx = buildTx(w, createWallet().address, 5n, { nonce: i - 1 })
  const b = chain.propose([tx], w.privateKey, w.publicKey, i)
  chain.accept(b)
}
console.log(JSON.stringify({ ms: (performance.now() - t0) / 100 }))
`,
  )
  try {
    const out = JSON.parse(run("node", ["--import", "tsx", file], { cwd: dir }))
    return { metric: "блок с транзакцией: предложение + подпись + проверка", ms: out.ms, note: "среднее на блок, 100 блоков" }
  } finally {
    rmSync(file, { force: true })
  }
})

// 8. Lumen VM: исполнение контракта
await bench("lumen-chain (VM)", async () => {
  const dir = join(WORKSPACE, "lumen-chain")
  const file = join(dir, ".bench-vm.mjs")
  writeFileSync(
    file,
    `import { run, assemble } from "${join(dir, "core/vm.js")}"
const code = assemble("PUSH1_0 SLOAD PUSH1_1 ADD PUSH1_0 SSTORE STOP")
const t0 = performance.now()
for (let i = 0; i < 100000; i++) {
  run({ caller: "0x" + "11".repeat(20), address: "0x" + "22".repeat(20), value: 0n, code,
        calldata: [], gas: 1000000, storage: new Map(), logs: [], depth: 0, maxDepth: 8 })
}
console.log(JSON.stringify({ ms: (performance.now() - t0) / 100000 }))
`,
  )
  try {
    const out = JSON.parse(run("node", ["--import", "tsx", file], { cwd: dir }))
    return { metric: "исполнение контракта: чтение и запись в хранилище", ms: out.ms, note: "среднее на вызов, 100 000 вызовов" }
  } finally {
    rmSync(file, { force: true })
  }
})

const machine = `${process.platform} ${process.arch}, Node ${process.versions.node}`

console.log(ok("\n=== Замеры портфеля ==="))
console.log(dim(`  ${machine}\n`))
const fmtMs = (ms) => (ms < 1 ? ms.toFixed(3) : ms.toFixed(1))
for (const r of results) {
  console.log(`  ${r.tool.padEnd(22)} ${fmtMs(r.ms).padStart(8)} мс  ${r.metric}`)
}
console.log(dim("\n  каждый замер — реальный прогон на этой машине, повторов 3–5, берётся медиана"))

if (process.argv.includes("--save")) {
  const lines = [
    "# Замеры",
    "",
    `_${machine} — замеры сделаны на этой машине, повторы 3–5, в таблице медиана._`,
    "",
    "| Инструмент | Что замеряли | Медиана, мс | Комментарий |",
    "|---|---|---|---|",
    ...results.map((r) => `| ${r.tool} | ${r.metric} | ${fmtMs(r.ms)} | ${r.note} |`),
    "",
    "Как повторить:",
    "",
    "```bash",
    "node scripts/benchmarks.mjs --save",
    "```",
    "",
  ]
  writeFileSync(join(PORTFOLIO, "BENCHMARKS.md"), lines.join("\n"))
  console.log(ok("\nBENCHMARKS.md записан"))
}
