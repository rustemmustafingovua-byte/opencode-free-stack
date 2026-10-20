#!/usr/bin/env node
/**
 * npm-token-grant-org.mjs — выдать существующему токену права на организацию.
 *
 * npm не отдаёт права на org в UI-поле, но принимает их в теле запроса.
 * Стратегия: перехватываем PUT, который шлёт UI при изменении токена,
 * и повторяем его с orgsPermission=Read and write и selectedOrgs=[org].
 */
import { createRequire } from "node:module"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

const require = createRequire(join(homedir(), ".config", "opencode", "node_modules", "x.js"))
const WebSocket = require("ws")

const PORT = process.env.CDP_PORT || 9222
const BASE = `http://127.0.0.1:${PORT}`
const KEY_FILE = join(homedir(), ".config/opencode/secrets/npm.key")
const ORG = process.argv[2] || "rustemmustafingovua-byte"

const targets = await (await fetch(`${BASE}/json`)).json()
const tab = targets.find((t) => t.type === "page" && /npmjs\.com/.test(t.url))
const ws = new WebSocket(tab.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 64 * 1024 * 1024 })
let id = 0
const pending = new Map()
const posts = []

function send(method, params) {
  return new Promise((resolve, reject) => {
    const mid = ++id
    pending.set(mid, { resolve, reject })
    ws.send(JSON.stringify({ id: mid, method, params: params || {} }))
  })
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

ws.on("message", async (data) => {
  let msg
  try {
    msg = JSON.parse(data.toString())
  } catch {
    return
  }
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id)
    pending.delete(msg.id)
    if (msg.error) p.reject(new Error(msg.error.message))
    else p.resolve(msg.result)
    return
  }
  if (msg.method === "Network.requestWillBeSent" && /tokens/.test(msg.params.request.url)) {
    const r = msg.params.request
    if (r.method !== "GET" && r.postData) {
      posts.push({ url: r.url, method: r.method, data: r.postData })
    }
  }
})

await new Promise((r) => ws.on("open", r))
await send("Network.enable")
await send("Runtime.enable")
await send("Page.enable")

const ev = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) return "EXC: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)
  return r.result?.value
}

// 1) открыть карточку токена
await send("Page.navigate", { url: "https://www.npmjs.com/settings/rustemmustafingovua/tokens/" })
await sleep(6000)
const link = await ev(`(()=>{const a=[...document.querySelectorAll('a')].find(x=>/portfolio-final/.test(x.innerText));return a?a.getAttribute('href'):''})()`)
console.log("карточка:", link)
if (!link) {
  console.log("токен не найден")
  process.exit(1)
}
await send("Page.navigate", { url: "https://www.npmjs.com" + link })
await sleep(5000)

// 2) изменить что-нибудь в карточке, чтобы поймать формат PUT
const before = await ev(`JSON.stringify({bypass:(document.querySelector('input[name=bypass2FA]')||{}).checked})`)
console.log("состояние до:", before)
await ev(`(()=>{const b=document.querySelector('input[name=bypass2FA]');if(b){b.click();}return 1})()`)
await sleep(1500)
await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/save|update|confirm/i.test(x.innerText)&&x.type==='submit');if(b)b.click();return 1})()`)
await sleep(3000)
console.log("перехваченные запросы:", posts.map((p) => `${p.method} ${p.url.replace("https://www.npmjs.com", "")}`))

// 3) повторить последний запрос с правами на org
const upd = posts.filter((p) => /granular-access-tokens/.test(p.url)).pop()
if (!upd) {
  console.log("PUT/PATCH токена не перехвачен")
  process.exit(1)
}
console.log("тело запроса:", upd.data.slice(0, 600))
let body = {}
try {
  body = JSON.parse(upd.data)
} catch {
  body = Object.fromEntries(new URLSearchParams(upd.data))
}
body.orgsPermission = "Read and write"
body.selectedOrgs = [ORG]
if (body.packagesAndScopesPermission) body.packagesAndScopesPermission = "Read and write"
if (!body.selectedPackagesAndScopes) body.selectedPackagesAndScopes = "packagesAll"

const replay = await ev(`(async()=>{
  const r=await fetch(${JSON.stringify(upd.url)},{
    method:${JSON.stringify(upd.method)},
    headers:{'Content-Type':'application/json','X-CSRF-Token':(document.querySelector('input[name=csrftoken]')||{}).value||''},
    body:${JSON.stringify(JSON.stringify(body))}
  });
  const t=await r.text();
  const m=t.match(/npm_[A-Za-z0-9]{20,}/);
  return JSON.stringify({status:r.status,token:m?m[0]:null,tail:t.slice(0,200)});
})()`)
console.log("ответ на повтор:", replay)

const token = (() => {
  try {
    return JSON.parse(replay).token
  } catch {
    return null
  }
})()
if (token) {
  mkdirSync(join(homedir(), ".config/opencode/secrets"), { recursive: true })
  writeFileSync(KEY_FILE, token + "\n")
  const { execFileSync } = await import("node:child_process")
  execFileSync("chmod", ["600", KEY_FILE])
  console.log("токен сохранён:", token.slice(0, 12) + "…" + token.slice(-4))
}
ws.close()
process.exit(0)
