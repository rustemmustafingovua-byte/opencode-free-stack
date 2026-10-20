#!/usr/bin/env node
/**
 * npm-token-capture.mjs — создать granular-токен npm и забрать его полное значение.
 *
 * npm показывает токен один раз, поэтому логируем сеть и DOM одновременно.
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

const targets = await (await fetch(`${BASE}/json`)).json()
const tab = targets.find((t) => t.type === "page" && /npmjs\.com/.test(t.url))
if (!tab) {
  console.error("нет вкладки npmjs.com")
  process.exit(2)
}

const ws = new WebSocket(tab.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 64 * 1024 * 1024 })
let id = 0
const pending = new Map()
const net = []

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
  if (msg.method === "Network.requestWillBeSent") {
    const r = msg.params.request
    if (/token/i.test(r.url)) net.push(`${r.method} ${r.url}`)
  }
  if (msg.method === "Network.responseReceived") {
    try {
      const body = await send("Network.getResponseBody", { requestId: msg.params.requestId })
      const m = (body?.body || "").match(/npm_[A-Za-z0-9]{20,}/)
      if (m) net.push(`TOKEN-FOUND ${m[0]}`)
    } catch {}
  }
})

await new Promise((r) => ws.on("open", r))
await send("Network.enable")
await send("Runtime.enable")
await send("Page.enable")

// открыть форму
await send("Page.navigate", {
  url: "https://www.npmjs.com/settings/rustemmustafingovua/tokens/granular-access-tokens/new",
})
await sleep(6000)

// watcher: ловим токен в DOM, если npm покажет его текстом
await send("Runtime.evaluate", {
  expression: `window.__npmToken='';clearInterval(window.__t);window.__t=setInterval(()=>{const m=document.body.innerText.match(/npm_[A-Za-z0-9]{20,}/);if(m&&!window.__npmToken)window.__npmToken=m[0];},150);1`,
})

// заполнить
await send("Runtime.evaluate", {
  expression: `(()=>{const i=document.querySelector('input[name=tokenName]');i.focus();i.value='';return 1})()`,
})
await send("Input.insertText", { text: TOKEN_NAME })
await sleep(500)
await send("Runtime.evaluate", {
  expression: `(()=>{const rw=document.getElementById('create-gat_packagesAndScopesPermission_Read-and-write');if(rw&&!rw.checked)rw.click();const all=document.getElementById('packagesAll');if(all&&!all.checked)all.click();const b2=document.querySelector('input[name=bypass2FA]');if(b2&&!b2.checked)b2.click();const i=document.querySelector('input[name=tokenName]');return JSON.stringify({name:i.value,rw:rw&&rw.checked,all:all&&all.checked,bypass:b2&&b2.checked})})()`,
})

// клик по кнопке настоящей мышью
const box = await send("Runtime.evaluate", {
  expression: `(()=>{const b=[...document.querySelectorAll('button')].find(x=>/generate token/i.test(x.innerText));if(!b)return null;b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height})})()`,
  returnByValue: true,
})
console.log("кнопка:", box.result?.value)
if (box.result?.value) {
  const { x, y } = JSON.parse(box.result.value)
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 })
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 })
}

await sleep(3000)
// npm может попросить пароль для токена с bypass 2FA
const hasPw = await send("Runtime.evaluate", {
  expression: `(()=>{const p=document.querySelector('input[type=password]');if(!p)return '';p.focus();p.value='';return 'pw'})()`,
  returnByValue: true,
})
if (hasPw.result?.value === "pw") {
  const pw = readFileSync(join(homedir(), ".config/opencode/secrets/npm-account.txt"), "utf8")
    .split("\n")
    .find((l) => l.startsWith("password:"))
    ?.replace("password:", "")
    .trim()
  if (pw) {
    await send("Input.insertText", { text: pw })
    await sleep(500)
    await send("Runtime.evaluate", {
      expression: `(()=>{const b=[...document.querySelectorAll('button')].find(x=>/confirm|submit|create|authenticate/i.test(x.innerText)&&x.type==='submit');if(b)b.click();return 1})()`,
    })
    console.log("пароль подтверждён")
  }
}
await sleep(6000)

const dom = await send("Runtime.evaluate", { expression: "window.__npmToken||''", returnByValue: true })
const token = dom.result?.value || (net.find((n) => n.startsWith("TOKEN-FOUND")) || "").replace("TOKEN-FOUND ", "")

console.log("сеть:", net.slice(-6))
if (token) {
  mkdirSync(join(homedir(), ".config/opencode/secrets"), { recursive: true })
  writeFileSync(KEY_FILE, token + "\n")
  const { execFileSync } = await import("node:child_process")
  execFileSync("chmod", ["600", KEY_FILE])
  console.log("токен сохранён:", KEY_FILE, "…", token.slice(0, 10), "…", token.slice(-4))
} else {
  console.log("токен не найден")
}
ws.close()
process.exit(0)
