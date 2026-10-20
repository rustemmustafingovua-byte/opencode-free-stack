#!/usr/bin/env node
/**
 * npm-token-org.mjs — токен npm с правами и на область, и на организацию.
 *
 * npm отдаёт 404 при публикации, если скоуп принадлежит организации, а у
 * токена нет прав на неё. Форма создания токена в веб-интерфейсе прячет
 * этот параметр, но сервер его принимает — поэтому перехватываем реальный
 * POST (в нём уже подписанный csrf-токен) и повторяем с orgsPermission.
 *
 *   node scripts/npm-token-org.mjs <имя токена>
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
const TOKEN_NAME = process.argv[2] || "portfolio-publish-org"
const ORG = process.argv[3] || "rustemmustafingovua-byte"

const targets = await (await fetch(`${BASE}/json`)).json()
const tab = targets.find((t) => t.type === "page" && /npmjs\.com/.test(t.url))
if (!tab) {
  console.error("нет вкладки npmjs.com — открой https://www.npmjs.com/settings/rustemmustafingovua/tokens/")
  process.exit(2)
}

const ws = new WebSocket(tab.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 64 * 1024 * 1024 })
let id = 0
const pending = new Map()
let captured = null
let token = ""

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
  if (msg.method === "Network.requestWillBeSent" && /new-gat/.test(msg.params.request.url)) {
    captured = msg.params.request.postData ?? null
  }
  if (msg.method === "Network.responseReceived" && /new-gat/.test(msg.params.response.url)) {
    try {
      const body = await send("Network.getResponseBody", { requestId: msg.params.requestId })
      const m = (body?.body || "").match(/npm_[A-Za-z0-9]{20,}/)
      if (m) token = m[0]
    } catch {}
  }
})

await new Promise((r) => ws.on("open", r))
await send("Network.enable")
await send("Runtime.enable")
await send("Page.enable")

const ev = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) return "EXC: " + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
  return r.result?.value
}

// 1. форма создания токена
await send("Page.navigate", {
  url: "https://www.npmjs.com/settings/rustemmustafingovua/tokens/granular-access-tokens/new",
})
await sleep(6000)

const step = async (expr, wait = 900) => {
  await ev(expr)
  await sleep(wait)
}

// имя токена
await ev(`(()=>{const i=document.querySelector('input[name=tokenName]');i.focus();i.value='';return 1})()`)
await send("Input.insertText", { text: TOKEN_NAME })
await sleep(500)

// права: read and write
await step(`(()=>{const rw=document.getElementById('create-gat_packagesAndScopesPermission_Read-and-write');if(rw&&!rw.checked)rw.click();return 1})()`, 1500)
// выбрать конкретный скоуп
await step(`(()=>{const s=document.getElementById('packagesAndScopesSome');if(s&&!s.checked)s.click();return 1})()`, 1800)
await step(`(()=>{const i=[...document.querySelectorAll('input')].find(x=>/filter packages/i.test(x.placeholder||''));if(i)i.focus();return 1})()`)
await send("Input.insertText", { text: "rustemmustafingovua" })
await sleep(2000)
await step(
  `(()=>{const b=[...document.querySelectorAll('button[aria-labelledby]')].find(x=>x.getAttribute('aria-labelledby')?.includes('create-gat_packagesAndScopes_menu_scope_label_@${ORG} '));if(b&&b.getAttribute('aria-checked')!=='true')b.click();return 1})()`,
  1500,
)
// bypass 2FA
await step(`(()=>{const b=document.querySelector('input[name=bypass2FA]');if(b&&!b.checked)b.click();return 1})()`, 1200)

// 2. отправляем форму — перехватываем реальный POST с подписанным csrf
await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/generate token/i.test(x.innerText));if(b)b.click();return 1})()`)
await sleep(2500)

// npm может попросить подтвердить пароль
const needPassword = await ev(`(()=>{const p=document.querySelector('input[type=password]');if(!p)return '';p.focus();p.value='';return 'pw'})()`)
if (needPassword === "pw") {
  const { readFileSync } = await import("node:fs")
  const accFile = join(homedir(), ".config/opencode/secrets/npm-account.txt")
  const pw = readFileSync(accFile, "utf8")
    .split("\n")
    .find((l) => l.startsWith("password:"))
    ?.replace("password:", "")
    .trim()
  if (pw) {
    await send("Input.insertText", { text: pw })
    await sleep(600)
    await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/confirm/i.test(x.innerText));if(b)b.click();return 1})()`)
    console.log("пароль подтверждён")
  }
}
await sleep(4000)

if (!captured) {
  console.error("POST не перехвачен")
  process.exit(1)
}
const body = JSON.parse(captured)
console.log("перехвачены поля:", Object.keys(body).join(", "))
console.log("orgsPermission в исходном POST:", body.orgsPermission, "| selectedOrgs:", JSON.stringify(body.selectedOrgs))

// 3. повторяем POST с правами на организацию (csrf остаётся подписанным)
const withOrg = { ...body, orgsPermission: "Read and write", selectedOrgs: [ORG] }
const res = await ev(`(async()=>{
  const r=await fetch("/settings/rustemmustafingovua/tokens/new-gat",{
    method:"POST",
    headers:{"Content-Type":"application/json","X-CSRF-Token":${JSON.stringify(body.csrftoken)}},
    body:${JSON.stringify(JSON.stringify(withOrg))}
  });
  const t=await r.text();
  const m=t.match(/npm_[A-Za-z0-9]{20,}/);
  return JSON.stringify({status:r.status,token:m?m[0]:null,body:t.slice(0,200)});
})()`)
console.log("ответ:", res)

const parsed = (() => {
  try {
    return JSON.parse(res)
  } catch {
    return {}
  }
})()
if (parsed.token) {
  token = parsed.token
  mkdirSync(join(homedir(), ".config/opencode/secrets"), { recursive: true })
  writeFileSync(KEY_FILE, token + "\n")
  const { execFileSync } = await import("node:child_process")
  execFileSync("chmod", ["600", KEY_FILE])
  console.log("токен сохранён:", token.slice(0, 12) + "…" + token.slice(-4))
}
ws.close()
process.exit(0)
