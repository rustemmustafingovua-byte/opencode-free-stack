#!/usr/bin/env node
/**
 * opire-scrape.mjs — снимает список баунтов с Opire через отрендеренную страницу.
 *
 * Данные приходят клиентским рендерингом, поэтому читаем их из DOM через CDP.
 *
 *   node scripts/opire-scrape.mjs            # JSON в stdout
 */
import { createRequire } from "node:module"
import { homedir } from "node:os"
import { join } from "node:path"

const require = createRequire(join(homedir(), ".config", "opencode", "node_modules", "x.js"))
const WebSocket = require("ws")

const CDP = process.env.CDP_PORT || 9222
const URL_PAGE = "https://app.opire.dev/home"

const tabs = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json()
let tab = tabs.find((t) => t.type === "page" && /opire\.dev/.test(t.url))
if (!tab) {
  // открываем новую вкладку
  const res = await fetch(`http://127.0.0.1:${CDP}/json/new?${encodeURIComponent(URL_PAGE)}`, { method: "PUT" })
  tab = await res.json()
}

const ws = new WebSocket(tab.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 64 * 1024 * 1024 })
let id = 0
const pending = new Map()
const send = (method, params) =>
  new Promise((resolve, reject) => {
    const i = ++id
    pending.set(i, { resolve, reject })
    ws.send(JSON.stringify({ id: i, method, params: params || {} }))
  })
ws.on("message", (d) => {
  let m
  try {
    m = JSON.parse(d.toString())
  } catch {
    return
  }
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id)
    pending.delete(m.id)
    m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result)
  }
})
await new Promise((r) => ws.on("open", r))
await send("Runtime.enable")
await send("Page.enable")
await send("Page.navigate", { url: URL_PAGE })
await new Promise((r) => setTimeout(r, 9000))

const res = await send("Runtime.evaluate", {
  expression: `(() => {
    const text = document.body.innerText || '';
    const lines = text.split('\\n').map(l => l.trim()).filter(Boolean);
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^\\$([\\d,.]+)$/);
      if (!m) continue;
      // выше: дата | владелец | репозиторий | заголовок | языки
      let owner = null, repo = null, title = null, langs = '';
      for (let j = i - 1; j >= Math.max(0, i - 7); j--) {
        const l = lines[j];
        if (!l || /Coins|Partner|Command available|Views|Earnable|Available|Paid|solvers/i.test(l)) continue;
        if (/^\\d{2}\\/\\d{2}\\/\\d{4}$/.test(l) && j >= 2) {
          owner = lines[j - 2]; repo = lines[j - 1]; title = lines[j + 1];
          langs = lines[j + 2] || '';
          break;
        }
      }
      if (!owner || !repo) continue;
      out.push({
        owner, repo, title: title || '',
        languages: langs,
        amount: Number(m[1].replace(/,/g, '')),
        tries: lines[i + 1] || '',
        solvers: lines[i + 2] || '',
      });
    }
    return JSON.stringify({ total: out, open: out });
  })()`,
  returnByValue: true,
})
ws.close()
const data = JSON.parse(res.result?.value || '{"total":[]}')
console.log(JSON.stringify(data.total, null, 1))
