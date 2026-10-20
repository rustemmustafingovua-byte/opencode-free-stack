#!/usr/bin/env node
/**
 * npm-token-bypass.mjs — создать granular-токен npm с bypass 2FA (нужен для публикации).
 *
 * npm требует либо 2FA-код при каждой публикации, либо токен с bypass 2FA.
 * Скрипт кликает по чекбоксу настоящей мышью, подтверждает пароль и забирает токен.
 */
import { createRequire } from "node:module"
import { writeFileSync, mkdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

const require = createRequire(join(homedir(), ".config", "opencode", "node_modules", "x.js"))
const WebSocket = require("ws")

const PORT = process.env.CDP_PORT || 9222
const BASE = `http://127.0.0.1:${PORT}`
const TOKEN_NAME = process.argv[2] || "portfolio-publish"
const KEY_FILE = join(homedir(), ".config/opencode/secrets/npm.key")
const ACC_FILE = join(homedir(), ".config/opencode/secrets/npm-account.txt")

const targets = await (await fetch(`${BASE}/json`)).json()
const tab = targets.find((t) => t.type === "page" && /npmjs\.com/.test(t.url))
const ws = new WebSocket(tab.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 64 * 1024 * 1024 })
let id = 0
const pending = new Map()
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
  if (msg.method === "Network.responseReceived") {
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

async function clickExpr(expr) {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true })
  return r.result?.value
}
async function realClick(selector) {
  const box = await clickExpr(
    `(()=>{const el=${selector};if(!el)return null;el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2})})()`,
  )
  if (!box) return false
  const { x, y } = JSON.parse(box)
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 })
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 })
  await sleep(400)
  return true
}

await send("Page.navigate", {
  url: "https://www.npmjs.com/settings/rustemmustafingovua/tokens/granular-access-tokens/new",
})
await sleep(6000)

await clickExpr(`(()=>{const i=document.querySelector('input[name=tokenName]');i.focus();i.value='';return 1})()`)
await send("Input.insertText", { text: TOKEN_NAME })
await sleep(400)

await clickExpr(`(()=>{const rw=document.getElementById('create-gat_packagesAndScopesPermission_Read-and-write');if(rw&&!rw.checked)rw.click();return 1})()`)
await sleep(1500)
// выбрать конкретный скоуп @rustemmustafingovua-byte (в нём лежат все пакеты)
await clickExpr(`(()=>{const s=document.getElementById('packagesAndScopesSome');if(s&&!s.checked)s.click();return 1})()`)
await sleep(1500)
await realClick(`[...document.querySelectorAll('input')].find(x=>/filter packages/i.test(x.placeholder||''))`)
await sleep(400)
await send("Input.insertText", { text: "rustemmustafingovua" })
await sleep(1500)
// выбираем и личный скоуп, и орг-скоуп
for (const scope of ["@rustemmustafingovua-byte", "@rustemmustafingovua "]) {
  await clickExpr(`(()=>{const b=[...document.querySelectorAll('button[aria-labelledby*=${JSON.stringify(scope)}]')][0];if(b&&b.getAttribute('aria-checked')!=='true')b.click();return 1})()`)
  await sleep(800)
}
await sleep(1200)
// переустановить имя токена (на случай если текст фильтра попал туда)
await clickExpr(`(()=>{const i=document.querySelector('input[name=tokenName]');if(i){i.focus();i.value='';}return 1})()`)
await send("Input.insertText", { text: TOKEN_NAME })
await sleep(600)

// чекбокс bypass 2FA — js-клик (состояние обновляется асинхронно)
await clickExpr(`(()=>{const b=document.querySelector('input[name=bypass2FA]');if(b&&!b.checked)b.click();return 1})()`)
await sleep(1200)
await clickExpr(`(()=>{const b=document.querySelector('input[name=bypass2FA]');if(b&&!b.checked)b.click();return 1})()`)
await sleep(1200)
const state = await clickExpr(
  `JSON.stringify({bypass:document.querySelector('input[name=bypass2FA]').checked,rw:(document.getElementById('create-gat_packagesAndScopesPermission_Read-and-write')||{}).checked,all:(document.getElementById('packagesAll')||{}).checked,name:document.querySelector('input[name=tokenName]').value})`,
)
console.log("состояние формы:", state)

// клик «Generate token»
await clickExpr(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>/generate token/i.test(x.innerText));if(b)b.click();return 1})()`)
await sleep(3000)

// если просят пароль — подтверждаем
const pwField = await clickExpr(
  `(()=>{const p=document.querySelector('input[type=password]');if(!p)return '';p.focus();p.value='';return 'pw'})()`,
)
if (pwField === "pw") {
  const pw = readFileSync(ACC_FILE, "utf8")
    .split("\n")
    .find((l) => l.startsWith("password:"))
    ?.replace("password:", "")
    .trim()
  if (pw) {
    await send("Input.insertText", { text: pw })
    await sleep(400)
    await realClick(`[...document.querySelectorAll('button')].find(x=>/confirm|authenticate|create|continue|submit/i.test(x.innerText)&&x.type==='submit')`)
    console.log("пароль подтверждён")
  }
}
await sleep(6000)

if (token) {
  mkdirSync(join(homedir(), ".config/opencode/secrets"), { recursive: true })
  writeFileSync(KEY_FILE, token + "\n")
  const { execFileSync } = await import("node:child_process")
  execFileSync("chmod", ["600", KEY_FILE])
  console.log("токен сохранён:", token.slice(0, 12) + "…" + token.slice(-4))
} else {
  console.log("токен не найден")
}
ws.close()
process.exit(0)
