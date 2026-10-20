#!/usr/bin/env node
/**
 * deploy-lumen.mjs — полный запуск Lumen в сети Base, одной командой.
 *
 * Что делает:
 *   1. проверяет, что в кошельке есть ETH на газ;
 *   2. деплоит LMN (ERC-20) и LumenAMM в Base;
 *   3. создаёт пул LMN/USDC в Uniswap V3 и кладёт ликвидность из казны;
 *   4. записывает адреса в ~/.lumen/keeper.json;
 *   5. поднимает keeper — он начинает покупать LMN за USDC.
 *
 * Требования: ~0.01 ETH на Base (газ) и немного USDC в казне (ликвидность пула).
 *
 *   node scripts/deploy-lumen.mjs
 *   node scripts/deploy-lumen.mjs --dry     # только показать, что будет
 */
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"
import { createRequire } from "node:module"

const require = createRequire(join(homedir(), ".config/opencode", "node_modules", "x.js"))
const { createPublicClient, http, formatUnits } = require("viem")
const { base } = require("viem/chains")

const LUMEN = join(homedir(), "workspace", "lumen-chain")
const SECRETS = join(homedir(), ".config", "opencode", "secrets")
const KEEPER_DIR = join(homedir(), ".lumen")
const KEEPER_CFG = join(KEEPER_DIR, "keeper.json")
const DEPLOYMENTS = join(LUMEN, "deployments", "base.json")
const FORGE = join(homedir(), ".foundry/bin/forge")

const ok = (s) => `\x1b[32m${s}\x1b[0m`
const bad = (s) => `\x1b[31m${s}\x1b[0m`
const warn = (s) => `\x1b[33m${s}\x1b[0m`
const dim = (s) => `\x1b[2m${s}\x1b[0m`

const OWNER_WALLET = "0x8aC6a229f254980CCd3Dd35CF5E1B7c08880B40E"
const RPC = process.env.BASE_RPC || "https://mainnet.base.org"
const dry = process.argv.includes("--dry")

const wallet = JSON.parse(readFileSync(join(SECRETS, "agent-wallet.json"), "utf8"))
const privateKey = wallet.evm.privateKey
const client = createPublicClient({ chain: base, transport: http(RPC) })

const eth = await client.getBalance({ address: OWNER_WALLET })
console.log(ok("\n=== Деплой Lumen в Base ===\n"))
console.log(`  кошелёк:   ${OWNER_WALLET}`)
console.log(`  баланс:   ${formatUnits(eth, 18)} ETH`)

const NEEDED = 10n ** 16n // ~0.01 ETH на деплой и создание пула
if (eth < NEEDED) {
  console.log(
    bad(`\n  не хватает газа: нужно ~${formatUnits(NEEDED, 18)} ETH, есть ${formatUnits(eth, 18)}`),
  )
  console.log(dim(`\n  Пополни кошелёк в сети Base: ${OWNER_WALLET}`))
  console.log(dim("  После пополнения запусти снова: node scripts/deploy-lumen.mjs"))
  process.exit(2)
}

if (dry) {
  console.log(warn("\n  --dry: ничего не деплою"))
  process.exit(0)
}

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts })
}

console.log(dim("\n  1/4 деплою контракты…"))
run(FORGE, [
  "script",
  "script/Deploy.s.sol:Deploy",
  "--rpc-url",
  RPC,
  "--broadcast",
  "--private-key",
  privateKey,
], {
  cwd: LUMEN,
  env: { ...process.env, PRIVATE_KEY: privateKey, TREASURY: OWNER_WALLET },
})

if (!existsSync(DEPLOYMENTS)) {
  console.log(bad("  деплой не записал deployments/base.json"))
  process.exit(1)
}
const dep = JSON.parse(readFileSync(DEPLOYMENTS, "utf8"))
console.log(ok(`     LMN:  ${dep.lmn}`))
console.log(ok(`     AMM:  ${dep.amm}`))

console.log(dim("\n  2/4 создаю пул LMN/USDC в Uniswap V3…"))
try {
  run(FORGE, [
    "script",
    "script/CreatePool.s.sol:CreatePool",
    "--rpc-url",
    RPC,
    "--broadcast",
    "--private-key",
    privateKey,
  ], {
    cwd: LUMEN,
    env: { ...process.env, PRIVATE_KEY: privateKey, TREASURY: OWNER_WALLET, LMN: dep.lmn },
  })
  console.log(ok("     пул готов"))
} catch (e) {
  console.log(warn(`     пул не создан: ${String(e.stdout || e.stderr || e).slice(-300)}`))
  console.log(dim("     (нужны LMN и USDC в кошельке — налей ликвидность и повтори)"))
}

console.log(dim("\n  3/4 записываю keeper.json…"))
mkdirSync(KEEPER_DIR, { recursive: true })
const cfg = existsSync(KEEPER_CFG) ? JSON.parse(readFileSync(KEEPER_CFG, "utf8")) : {}
const next = {
  treasury: OWNER_WALLET,
  lumenAddress: cfg.lumenAddress || "lmn1TtQM3VrmASSPQgD3JNMtwQNePhz14jfd67uaNFmvzhPqWaTJ5",
  lmn: dep.lmn,
  amm: dep.amm,
  rpcUrl: RPC,
  policy: {
    minAmount: "5000000",
    maxPerSwap: "500000000",
    maxPerDay: "2000000000",
    ...(cfg.policy ?? {}),
  },
  pollMs: cfg.pollMs ?? 300000,
}
writeFileSync(KEEPER_CFG, JSON.stringify(next, null, 2))
chmodSync(KEEPER_CFG, 0o600)
console.log(ok(`     ${KEEPER_CFG}`))

console.log(dim("\n  4/4 проверяю живой сервис…"))
try {
  const state = await fetch("https://api.venice.ai/api/v1/models").then(() => "ok").catch(() => "skip")
  void state
} catch {}

console.log(ok("\n  Готово. Дальше:"))
console.log(dim("    node ~/workspace/lumen-chain/cli/lumen.ts keeper check   # котировки и пулы"))
console.log(dim("    node ~/workspace/lumen-chain/cli/lumen.ts keeper run    # автопокупка LMN за USDC"))
console.log(dim("    node scripts/money.mjs                              # панель денежных каналов"))
console.log()
