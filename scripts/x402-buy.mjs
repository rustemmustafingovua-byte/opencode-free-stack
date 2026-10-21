#!/usr/bin/env node
/**
 * x402-buy — покупка данных/вызовов у MCP-сервисов за USDC или нативный ETH.
 *
 * Клиент x402: спрашивает «что это стоит», подписывает оплату (EIP-3009
 * transferWithAuthorization) или переводит ETH напрямую, повторяет запрос с
 * доказательством оплаты и получает ответ.
 *
 *   x402-buy "https://<host>/mcp/paid" tools/list
 *   x402-buy "https://<host>/mcp/paid" tools/call '{"name":"free-web-search","arguments":{"query":"mcp"}}'
 *
 * Ключи: X402_PRIVATE_KEY (кошелёк плательщика) или X402_SIGNER_URL (внешний сервис подписи).
 * Адрес получателя берётся из 402-ответа — клиенту не нужно ничего знать заранее.
 */
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"
import { createRequire } from "node:module"

const require = createRequire(join(homedir(), ".config", "opencode", "node_modules", "x.js"))
const { createPublicClient, createWalletClient, http, parseAbi, erc20Abi, formatUnits } = require("viem")
const { base } = require("viem/chains")

const ok = (s) => `\x1b[32m${s}\x1b[0m`
const bad = (s) => `\x1b[31m${s}\x1b[0m`
const dim = (s) => `\x1b[2m${s}\x1b[0m`
const warn = (s) => `\x1b[33m${s}\x1b[0m`

const argv = process.argv.slice(2)
const url = argv[0]
const method = argv[1] ?? "tools/list"
const params = argv[2] ? JSON.parse(argv[2]) : {}

if (!url) {
  console.log(ok("x402-buy — купить вызов MCP-сервиса за USDC или ETH\n"))
  console.log("  x402-buy <url> [method] [params-json]")
  console.log("")
  console.log(dim("  Ключ плательщика: X402_PRIVATE_KEY=0x… (или X402_SIGNER_URL=http://…)"))
  console.log(dim("  Получатель и сумма берутся из ответа 402 — вручную ничего вводить не нужно."))
  process.exit(0)
}

const PRIVATE_KEY = process.env.X402_PRIVATE_KEY || loadDefaultKey()
const BASE_RPC = process.env.BASE_RPC || "https://mainnet.base.org"
const publicClient = createPublicClient({ chain: base, transport: http(BASE_RPC) })

function loadDefaultKey() {
  const f = join(homedir(), ".config", "opencode", "secrets", "agent-wallet.json")
  if (existsSync(f)) {
    try {
      return JSON.parse(readFileSync(f, "utf8"))?.evm?.privateKey
    } catch {}
  }
  return ""
}

const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })

async function call(headers = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
    body,
  })
  const text = await res.text()
  return { status: res.status, headers: res.headers, text }
}

/** Разбор JSON-RPC ответа, который может прийти как SSE. */
function parseRpc(text) {
  const trimmed = text.trim()
  if (trimmed.startsWith("data:")) {
    const line = trimmed.split("\n").find((l) => l.startsWith("data:"))
    try {
      return JSON.parse(line.slice(5).trim())
    } catch {}
  }
  try {
    return JSON.parse(trimmed)
  } catch {}
  return { raw: text }
}

async function main() {
  // 1. первый запрос — сервер ответит 402 с условиями оплаты
  const first = await call()
  if (first.status !== 402) {
    console.log(ok("ответ получен без оплаты:"))
    console.log(first.text.slice(0, 800))
    return
  }

  let terms = null
  const header = first.headers.get("payment-required")
  if (header) {
    try {
      terms = JSON.parse(Buffer.from(header, "base64").toString())
    } catch {}
  }
  const bodyJson = parseRpc(first.text)
  const ways = bodyJson?.ways ?? terms?.accepts ?? []
  console.log(dim("  сервер требует оплату:"))
  for (const w of ways) {
    console.log(dim(`    ${w.kind} | ${w.asset} | ${w.amount} | получатель ${w.payTo}`))
  }
  if (!PRIVATE_KEY) {
    console.log(bad("  нет ключа плательщика: задай X402_PRIVATE_KEY"))
    process.exit(2)
  }

  // 2. выбираем способ: нативный ETH проще (перевод + хеш), иначе EIP-3009
  // адрес берём из ключа: публичные RPC режут eth_accounts
  const { privateKeyToAccount } = require("viem/accounts")
  const account = privateKeyToAccount(PRIVATE_KEY)
  const addr = account.address
  const wallet = createWalletClient({ account, chain: base, transport: http(BASE_RPC) })
  const usdcWay = ways.find((w) => w.kind === "eip3009-authorization" || (w.asset && w.asset !== "ETH"))
  const ethWay = ways.find((w) => w.kind === "native-eth-transfer" || w.asset === "ETH")

  if (ethWay) {
    const value = BigInt(ethWay.amount)
    const hash = await wallet.sendTransaction({
      to: ethWay.payTo,
      value,
      chain: base,
      account,
    })
    console.log(ok(`  оплата ETH отправлена: ${hash}`))
    const paid = await call({ "X-PAYMENT-TX": hash })
    console.log(ok(`  ответ (${paid.status}):`))
    console.log(paid.text.slice(0, 2000))
    return
  }

  if (usdcWay) {
    // EIP-3009: подписываем transferWithAuthorization
    const { signTypedData } = require("viem/accounts")
    const amount = BigInt(usdcWay.amount)
    const nonce = keccakHex(randomBytes32())
    const validAfter = BigInt(Math.floor(Date.now() / 1000) - 60)
    const validBefore = BigInt(Math.floor(Date.now() / 1000) + 300)
    const domain = {
      name: "USD Coin",
      version: "2",
      chainId: 8453,
      verifyingContract: usdcWay.asset,
    }
    const types = {
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    }
    const message = {
      from: addr,
      to: usdcWay.payTo,
      value: amount,
      validAfter,
      validBefore,
      nonce,
    }
    const signature = await signTypedData({
      account,
      domain,
      types,
      primaryType: "TransferWithAuthorization",
      message,
    })
    const payload = {
      authorization: {
        from: addr,
        to: usdcWay.payTo,
        value: amount.toString(),
        validAfter: validAfter.toString(),
        validBefore: validBefore.toString(),
        nonce,
      },
      signature,
    }
    const paid = await call({ "PAYMENT-SIGNATURE": Buffer.from(JSON.stringify(payload)).toString("base64") })
    console.log(ok(`  ответ (${paid.status}):`))
    console.log(paid.text.slice(0, 2000))
    return
  }

  console.log(bad("  сервер не предложил способ оплаты"))
}

function randomBytes32() {
  const { randomBytes } = require("node:crypto")
  return `0x${randomBytes(32).toString("hex")}`
}

function keccakHex(hex) {
  const { keccak256 } = require("viem")
  return keccak256(hex)
}

await main()
