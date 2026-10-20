#!/usr/bin/env node
/**
 * publish-packages.mjs — one command publishes the whole portfolio.
 *
 *   npm login          (once)
 *   node scripts/publish-packages.mjs
 *
 * What it does:
 *   1. npm publish for every package (skips the ones already on npm)
 *   2. publishes the MCP server manifests to the official MCP Registry
 *   3. refreshes the model registry and the live demo URL
 */
import { execFileSync } from "node:child_process"
import { readFileSync, existsSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

const WORKSPACE = join(homedir(), "workspace")
const REGISTRY = "https://registry.modelcontextprotocol.io/v0.1"

const PACKAGES = [
  "opencode-free-stack",
  "free-web-mcp",
  "agent-x402",
  "mcp-doctor",
  "mcp-proxy",
  "tool-schema-lint",
  "prompt-budget",
  "agent-cost-guard",
  "opencode-doctor",
  "free-tier-tracker",
  "x402-priceboard",
  "prompt-injection-guard",
  "readme-doctor",
]

const MCP_SERVERS = ["free-web-mcp", "agent-x402"]

const ok = (s) => `\x1b[32m${s}\x1b[0m`
const warn = (s) => `\x1b[33m${s}\x1b[0m`
const bad = (s) => `\x1b[31m${s}\x1b[0m`
const dim = (s) => `\x1b[2m${s}\x1b[0m`

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts })
}

function npmWhoami() {
  try {
    return sh("npm", ["whoami"]).trim()
  } catch {
    return null
  }
}

async function npmPublish(slug) {
  const dir = join(WORKSPACE, slug)
  if (!existsSync(dir)) return { slug, status: "нет каталога" }
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"))
  try {
    const out = sh("npm", ["view", `${pkg.name}@${pkg.version}`, "version"], { cwd: dir })
    if (out.trim() === pkg.version) return { slug, status: "уже на npm", version: pkg.version }
  } catch {}
  try {
    const out = sh("npm", ["publish", "--access", "public"], { cwd: dir, stdio: ["ignore", "pipe", "pipe"] })
    return { slug, status: "опубликован", detail: out.trim().split("\n").slice(-2).join(" ") }
  } catch (e) {
    return { slug, status: "ошибка", detail: String(e.stderr || e.message).slice(0, 200) }
  }
}

async function registryToken() {
  const gh = join(homedir(), ".config", "opencode", "secrets", "github.key")
  if (!existsSync(gh)) return null
  const token = readFileSync(gh, "utf8").trim()
  const res = await fetch(`${REGISTRY}/auth/github-at`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ github_token: token }),
  })
  if (!res.ok) return null
  return (await res.json()).registry_token
}

async function registryPublish(slug, rt) {
  const file = join(WORKSPACE, slug, "server.json")
  if (!existsSync(file)) return { slug, status: "нет server.json" }
  const body = readFileSync(file, "utf8")
  const res = await fetch(`${REGISTRY}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${rt}` },
    body,
  })
  const text = await res.text()
  if (res.ok) return { slug, status: "в MCP Registry" }
  return { slug, status: "ошибка", detail: text.slice(0, 200) }
}

const who = npmWhoami()
if (!who) {
  console.log(bad("npm не авторизован. Выполните:  npm login"))
  console.log(dim("После этого запустите:  node scripts/publish-packages.mjs"))
  process.exit(2)
}
console.log(ok(`npm: ${who}`))

console.log(ok("\n=== 1. npm publish ==="))
for (const slug of PACKAGES) {
  const r = await npmPublish(slug)
  console.log(`  ${r.status === "опубликован" ? "✓" : "·"} ${slug.padEnd(24)} ${r.status}${r.detail ? " — " + dim(r.detail) : ""}`)
}

console.log(ok("\n=== 2. MCP Registry ==="))
const rt = await registryToken()
if (!rt) console.log(warn("  не удалось получить registry-токен"))
for (const slug of MCP_SERVERS) {
  const r = await registryPublish(slug, rt)
  console.log(`  ${r.status === "в MCP Registry" ? "✓" : "·"} ${slug.padEnd(24)} ${r.status}${r.detail ? " — " + dim(r.detail) : ""}`)
}

console.log(ok("\n=== 3. Реестр моделей и демо ==="))
try {
  sh("node", [join(WORKSPACE, "opencode-free-stack", "scripts", "sync-models.mjs")], { cwd: join(WORKSPACE, "opencode-free-stack") })
  console.log("  ✓ models.json обновлён")
} catch (e) {
  console.log(warn("  ! " + String(e.message).slice(0, 120)))
}
try {
  sh("bash", [join(homedir(), ".config", "opencode", "scripts", "free-web-keepalive.sh")])
  const url = join(homedir(), ".local", "state", "free-web-url.txt")
  if (existsSync(url)) console.log("  ✓ live demo:", readFileSync(url, "utf8").trim())
} catch {}

console.log(ok("\nготово"))
