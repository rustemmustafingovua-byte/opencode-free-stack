#!/usr/bin/env node
/**
 * money.mjs — панель денежных каналов.
 *
 * Показывает по каждому каналу: сколько пришло, что мешает и что сделать дальше.
 * Все адреса — один (кошелёк владельца), он же в MetaMask.
 *
 *   node scripts/money.mjs
 */
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"
import { createPublicClient, http, formatUnits } from "viem"
import { base } from "viem/chains"

const WORKSPACE = join(homedir(), "workspace")
const SECRETS = join(homedir(), ".config/opencode/secrets")
const STATE = join(homedir(), ".local/state")

/** Куда приходят все деньги: кошелёк владельца (он же импортирован в MetaMask). */
export const OWNER_WALLET = "0x8aC6a229f254980CCd3Dd35CF5E1B7c08880B40E"
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"

const ok = (s) => `\x1b[32m${s}\x1b[0m`
const bad = (s) => `\x1b[31m${s}\x1b[0m`
const warn = (s) => `\x1b[33m${s}\x1b[0m`
const dim = (s) => `\x1b[2m${s}\x1b[0m`

const client = createPublicClient({ chain: base, transport: http() })

async function balances() {
  const [eth, usdc] = await Promise.all([
    client.getBalance({ address: OWNER_WALLET }),
    client.readContract({
      address: USDC_BASE,
      abi: [
        {
          name: "balanceOf",
          type: "function",
          stateMutability: "view",
          inputs: [{ name: "account", type: "address" }],
          outputs: [{ type: "uint256" }],
        },
      ],
      functionName: "balanceOf",
      args: [OWNER_WALLET],
    }),
  ])
  return { eth, usdc: BigInt(usdc) }
}

function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch {
    return fallback
  }
}

const rows = []

console.log(ok("\n=== Денежный контур ===\n"))
console.log(`  Кошелёк (Base): ${OWNER_WALLET}`)
console.log(dim("  тот же адрес в MetaMask → «Imported Account 1»\n"))

const { eth, usdc } = await balances()
console.log(`  Баланс: ${formatUnits(eth, 18)} ETH · ${formatUnits(usdc, 6)} USDC\n`)

// 1. Платный MCP-эндпоинт (x402)
const freeWebUrl = existsSync(join(STATE, "free-web-url.txt"))
  ? readFileSync(join(STATE, "free-web-url.txt"), "utf8").trim()
  : ""
const price = process.env.X402_PRICE_USD ?? "0.001"
rows.push({
  channel: "Платный MCP (x402)",
  where: freeWebUrl ? `${freeWebUrl}/mcp` : "—",
  status: freeWebUrl ? "жив" : "не запущен",
  next: "включить цену (X402_PRICE_USD) и забрать ETH на газ для сбора USDC",
})

// 1b. Платный API без газа: клиент платит сам, сервер только проверяет
rows.push({
  channel: "Платный API — способ без газа (работает при нуле)",
  where: "клиент сам переводит USDC и шлёт X-PAYMENT-TX; сервер только читает сеть",
  status: "реализовано и покрыто тестом",
  next: "включить: X402_PRICE_USD=0.001 (газ платит плательщик, не мы)",
})

// 2. Lumen
const lumenUrl = existsSync(join(STATE, "lumen-url.txt"))
  ? readFileSync(join(STATE, "lumen-url.txt"), "utf8").trim()
  : ""
const keeperCfg = readJson(join(homedir(), ".lumen/keeper.json"), {})
const lmnDeployed = Boolean(keeperCfg.lmn && keeperCfg.lmn !== "0x0000000000000000000000000000000000000000")
rows.push({
  channel: "Lumen (своя крипта)",
  where: lumenUrl ? `${lumenUrl}/` : "—",
  status: lmnDeployed ? "контракты задеплоены" : "контракты не задеплоены",
  next: lmnDeployed
    ? "наполнить пул LMN/USDC и включить keeper"
    : "контракты требуют газа. Без газа Lumen остаётся open-source проектом: звёзды, спонсоры, баунти",
})

// 3. npmjs.org
const npmKey = existsSync(join(SECRETS, "npm.key"))
const npmWho = (() => {
  try {
    return readFileSync(join(SECRETS, "npm-account.txt"), "utf8").match(/username:\s*(\S+)/)?.[1] ?? null
  } catch {
    return null
  }
})()
rows.push({
  channel: "npmjs.org (дистрибуция → звёзды → донаты)",
  where: npmWho ? `npmjs.com/~${npmWho}` : "—",
  status: npmKey ? "токен есть, публикация ждёт разрешения npm" : "нет токена",
  next: "1 клик в npm UI: права токена на организацию → node scripts/npm-publish.mjs",
})

// 4. GitHub Sponsors
rows.push({
  channel: "GitHub Sponsors",
  where: "github.com/sponsors/rustemmustafingovua-byte",
  status: "требует подтверждения sudo-режима (GitHub Mobile или код на почту)",
  next: "подтвердить вход по ссылке из письма и включить Sponsors",
})

// 5. Баунти
rows.push({
  channel: "Баунти за contributions",
  where: "issues с меткой 💰 Reward в 15 репозиториях",
  status: "ишью открыты, финансируются сторонниками через /reward",
  next: "найти Opire/Algora-баунти и взять работу",
})

for (const r of rows) {
  console.log(`  ${r.channel}`)
  console.log(dim(`    адрес: ${r.where}`))
  console.log(dim(`    сейчас: ${r.status}`))
  console.log(warn(`    дальше: ${r.next}\n`))
}

console.log(ok("  Итог:"))
if (eth === 0n) {
  console.log(bad("    на кошельке 0 ETH — поэтому всё сделано так, чтобы не тратить:"))
  console.log(ok("     • платный API: газ платит клиент, сервер только проверяет транзакцию (работает при нуле)"))
  console.log(ok("     • npmjs.org, GitHub Sponsors, USDC-донаты — бесплатные каналы"))
  console.log(ok("     • баунти: деньги платит заказчик, а не мы"))
  console.log(ok("     • Lumen — open-source проект: доход из звёзд, спонсоров и баунти"))
  console.log(dim("    on-chain-часть Lumen (контракты, пул Uniswap) включается позже, когда появится газ"))
} else {
  console.log(ok(`    ETH на газ есть (${formatUnits(eth, 18)}) — можно включать платный сбор и деплой Lumen`))
}
if (usdc === 0n) {
  console.log(dim("    USDC на счёте нет — значит никто ещё не платил; можно проверить оплату самому"))
}
console.log()
