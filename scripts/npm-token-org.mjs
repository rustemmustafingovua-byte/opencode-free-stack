#!/usr/bin/env node
/**
 * npm-token-org.mjs — токен npm с правом публикации в org-скоуп @rustemmustafingovua-byte.
 *
 * npm отдаёт структуру POST-запроса создания токена; нужен лишь параметр
 * orgsPermission=Read and write и selectedOrgs=[<org>].
 */
import { createRequire } from "node:module"
import { writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

const require = createRequire(join(homedir(), ".config", "opencode", "node_modules", "x.js"))
const WebSocket = require("ws")

const PORT = process.env.CDP_PORT || 9222
const BASE = `http://127.0.0.1:${PORT}`
const KEY_FILE = join(homedir(), ".config/opencode/secrets/npm.key")
const TOKEN_NAME = process.argv[2] || "portfolio-publish"
const ORG = process.argv[3] || "rustemmustafingovua-byte"

const targets = await (await fetch(`${BASE}/json`)).json()
const tab = targets.find((t) => t.type === "page" && /npmjs\.com/.test(t.url))
const ws = new WebSocket(tab.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 64 * 1024 * 1024 })
let id = 0
const pending = new Map()

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
  if (msg.method === "Network.requestWillBeSent" && /new-gat/.test(msg.params.request.url)) {
    try {
      const pd = msg.params.request.postData || "";
      await send("Runtime.evaluate", { expression: `window.__capturedPostData=${JSON.stringify(pd)}` });
    } catch {}
  }
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id)
    pending.delete(msg.id)
    if (msg.error) p.reject(new Error(msg.error.message))
    else p.resolve(msg.result)
  }
})

await new Promise((r) => ws.on("open", r))
await send("Runtime.enable")
await send("Network.enable")
await send("Page.enable")

const ev = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) return "EXC: " + r.exceptionDetails.text
  return r.result?.value
}

await send("Page.navigate", { url: "https://www.npmjs.com/settings/rustemmustafingovua/tokens/granular-access-tokens/new" })
await sleep(6000)

// сначала ловим реальный POST (в нём подписанный csrf), затем повторяем с org-полями
await ev(`(()=>{const rw=document.getElementById('create-gat_packagesAndScopesPermission_Read-and-write');if(rw&&!rw.checked)rw.click();return 1})()`)
await sleep(1200)
await ev(`(()=>{const a=document.getElementById('packagesAll');if(a&&!a.checked)a.click();return 1})()`)
await sleep(1200)
await ev(`(()=>{const b=document.querySelector('input[name=bypass2FA]');if(b&&!b.checked)b.click();return 1})()`)
await sleep(1200)
await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/generate token/i.test(x.innerText));if(b)b.click();return 1})()`)
await sleep(3000)

const res = await ev(`(async()=>{
  const csrf=window.__capturedPostData ? (JSON.parse(window.__capturedPostData).csrftoken||'') : '';
  const body={
    csrftoken:csrf,
    bypass2FA:true,
    tokenName:${JSON.stringify(TOKEN_NAME)},
    tokenDescription:'Публикация пакетов портфеля в org @${ORG}',
    expirationDays:'90',
    allowedIPRanges:[''],
    packagesAndScopesPermission:'Read and write',
    selectedPackagesAndScopes:'packagesAll',
    selectedPackages:[],
    selectedScopes:[],
    orgsPermission:'Read and write',
    selectedOrgs:[${JSON.stringify(ORG)}]
  };
  const r=await fetch('/settings/rustemmustafingovua/tokens/new-gat',{
    method:'POST',
    headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},
    body:JSON.stringify(body)
  });
  const t=await r.text();
  const m=t.match(/npm_[A-Za-z0-9]{20,}/);
  return JSON.stringify({status:r.status,token:m?m[0]:null,body:t.slice(0,300)});
})()`)

console.log("ответ:", res)
const token = (() => {
  try {
    return JSON.parse(res).token
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
} else {
  console.log("токен не создан")
}
ws.close()
process.exit(0)
