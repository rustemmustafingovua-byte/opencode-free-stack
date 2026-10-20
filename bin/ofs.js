#!/usr/bin/env node
/**
 * ofs — opencode-free-stack CLI
 *
 *   ofs models           list every known free model
 *   ofs status           show which providers are configured and their quota state
 *   ofs route "<prompt>"  send one prompt through the fallback chain
 *   ofs chain             show the fallback order that would be used
 */
import { FreeRouter, routerFromEnv, listFreeModels, PROVIDERS } from "../src/index.js"

// --- CLI shell: --help / --version -------------------------------------------
const HELP = "ofs — Free-model router for OpenCode.\n\nUSAGE\n  ofs models\n  ofs status\n  ofs chain\n  ofs route \"explain quicksort\"\n\nCOMMANDS / OPTIONS\n  models          list every known free model, grouped by provider\n  status          which providers are configured and how much quota is left\n  chain           print the fallback order that would be used\n  route <prompt>  send one prompt through the fallback chain\n\nEnvironment: OPENCODE_API_KEY, GITHUB_TOKEN, BEATAPI_API_KEY, APINEX_API_KEY\n\nMIT · https://github.com/rustemmustafingovua-byte"
const VERSION = "0.1.0"
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(HELP)
  process.exit(0)
}
if (process.argv.includes("--version") || process.argv.includes("-V")) {
  console.log(VERSION)
  process.exit(0)
}


const cmd = process.argv[2] || "status"
const args = process.argv.slice(3)

const router = routerFromEnv()

switch (cmd) {
  case "models": {
    const rows = listFreeModels()
    console.log(`${rows.length} free models known:\n`)
    const byProvider = new Map()
    for (const r of rows) {
      if (!byProvider.has(r.provider)) byProvider.set(r.provider, [])
      byProvider.get(r.provider).push(r)
    }
    for (const [pid, list] of byProvider) {
      console.log(`  ${PROVIDERS[pid].name} (${pid})`)
      for (const r of list) console.log(`    ${r.model}${r.weight > 1 ? `   [weight ${r.weight}]` : ""}`)
    }
    break
  }
  case "status": {
    console.log("provider            key   rpm   pool")
    for (const s of router.status()) {
      const pool = s.pool ? `${Math.round(s.pool.ratio * 100)}% left` : "-"
      console.log(
        `  ${s.provider.padEnd(18)} ${(s.hasKey ? "yes" : "no ").padEnd(5)} ${String(s.rpm ?? "-").padEnd(5)} ${pool}`,
      )
    }
    break
  }
  case "chain": {
    const res = await router.chat([{ role: "user", content: "hi" }], { dryRun: true })
    console.log(res.chain.map((c, i) => `${i + 1}. ${c.provider}/${c.model}`).join("\n"))
    break
  }
  case "route": {
    const prompt = args.join(" ")
    if (!prompt) {
      console.error('usage: ofs route "<prompt>"')
      process.exit(1)
    }
    const res = await router.chat([{ role: "user", content: prompt }], { maxTokens: 400 })
    if (!res.ok) {
      console.error("failed:", res.error)
      for (const a of res.attempts || []) console.error(`  ${a.provider}/${a.model}: ${a.kind} ${a.error || ""}`)
      process.exit(1)
    }
    console.log(`[${res.provider}/${res.model}]`)
    console.log(res.content)
    break
  }
  default:
    console.log("ofs <models|status|chain|route>")
}
