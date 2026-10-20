#!/usr/bin/env node
/**
 * npm-publish.mjs — публикация всех пакетов портфеля на npmjs.org.
 *
 *   node scripts/npm-publish.mjs --capture   забрать токен из ~/.npmrc в secrets/npm.key
 *   node scripts/npm-publish.mjs             опубликовать всё, что ещё не опубликовано
 *   node scripts/npm-publish.mjs --dry       только показать план
 *
 * Имена: все пакеты публикуются в области @rustemmustafingovua-byte/*,
 * потому что короткие имена (mcp-doctor, mcp-proxy, agent-cost-guard,
 * readme-doctor) уже заняты другими людьми на npmjs.org.
 *
 * Токен берётся из (по приоритету):
 *   1) NPM_TOKEN в окружении
 *   2) ~/.config/opencode/secrets/npm.key
 *   3) ~/.npmrc (то, что создаёт `npm login`)
 */
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

const WORKSPACE = join(homedir(), "workspace")
const SCOPE = "rustemmustafingovua-byte"
const KEY_FILE = join(homedir(), ".config/opencode/secrets/npm.key")
const NPMRC = join(homedir(), ".npmrc")
const REGISTRY = "https://registry.npmjs.org/"

const PACKAGES = [
  "opencode-free-stack",
  "agent-browser-mcp",
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
  "lumen-chain",
]

const ok = (s) => `\x1b[32m${s}\x1b[0m`
const warn = (s) => `\x1b[33m${s}\x1b[0m`
const bad = (s) => `\x1b[31m${s}\x1b[0m`
const dim = (s) => `\x1b[2m${s}\x1b[0m`
const args = process.argv.slice(2)

function tokenFromNpmrc() {
  if (!existsSync(NPMRC)) return ""
  const m = readFileSync(NPMRC, "utf8").match(/_authToken\s*=\s*(\S+)/)
  return m ? m[1] : ""
}

function token() {
  if (process.env.NPM_TOKEN) return process.env.NPM_TOKEN.trim()
  if (existsSync(KEY_FILE)) return readFileSync(KEY_FILE, "utf8").trim()
  return tokenFromNpmrc()
}

function saveToken(t) {
  mkdirSync(join(homedir(), ".config/opencode/secrets"), { recursive: true })
  writeFileSync(KEY_FILE, t + "\n")
  execFileSync("chmod", ["600", KEY_FILE])
}

function sh(cmd, a, opts = {}) {
  return execFileSync(cmd, a, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts })
}

async function published(name, version) {
  const res = await fetch(`${REGISTRY}${encodeURIComponent(name).replace("%40", "@")}`.replace("%2F", "%2f"))
  if (!res.ok) return false
  const j = await res.json()
  return Boolean(j.versions && j.versions[version])
}

// 1) capture
if (args.includes("--capture")) {
  const t = tokenFromNpmrc()
  if (!t) {
    console.log(bad("в ~/.npmrc нет _authToken — сначала выполни: npm login"))
    process.exit(2)
  }
  saveToken(t)
  console.log(ok(`токен сохранён: ${KEY_FILE} (600)`))
  process.exit(0)
}

const tok = token()
if (!tok) {
  console.log(bad("нет npm-токена. Что делать:"))
  console.log(dim("  1. восстанови пароль: https://www.npmjs.com/forgot  (логин: crooj026)"))
  console.log(dim("  2. npm login"))
  console.log(dim("  3. node scripts/npm-publish.mjs --capture   # забрать токен в secrets/npm.key"))
  console.log(dim("  4. node scripts/npm-publish.mjs             # опубликовать всё"))
  process.exit(2)
}

const npmrc = join(homedir(), ".npmrc")
const authLine = `//registry.npmjs.org/:_authToken=${tok}\n@${SCOPE}:registry=${REGISTRY}`
if (!existsSync(npmrc)) writeFileSync(npmrc, authLine + "\n")
else {
  const cur = readFileSync(npmrc, "utf8")
  if (!cur.includes("_authToken")) writeFileSync(npmrc, cur.trimEnd() + "\n" + authLine + "\n")
}
if (!existsSync(KEY_FILE)) saveToken(tok)

const dry = args.includes("--dry")
console.log(ok(`публикация ${PACKAGES.length} пакетов в область @${SCOPE}${dry ? " (dry-run)" : ""}\n`))

for (const slug of PACKAGES) {
  const dir = join(WORKSPACE, slug)
  const pkgFile = join(dir, "package.json")
  if (!existsSync(pkgFile)) {
    console.log(warn(`  ${slug}: нет каталога — пропуск`))
    continue
  }
  const pkg = JSON.parse(readFileSync(pkgFile, "utf8"))
  const scoped = `@${SCOPE}/${slug}`
  const already = await published(scoped, pkg.version)
  if (already) {
    console.log(dim(`  ${scoped}@${pkg.version} — уже на npmjs.org`))
    continue
  }
  if (dry) {
    console.log(`  ${scoped}@${pkg.version} — публиковать`)
    continue
  }
  // публикуем из временной копии, чтобы не менять package.json в репозитории
  const tmp = join("/tmp", `npm-publish-${slug}`)
  sh("rm", ["-rf", tmp])
  sh("mkdir", ["-p", tmp])
  for (const f of ["package.json", "README.md", "LICENSE", "bin", "src", "core", "cli", "keeper", "contracts", "docs", "dist", "test"]) {
    const src = join(dir, f)
    if (!existsSync(src)) continue
    sh("cp", ["-R", src, join(tmp, f)])
  }
  const p2 = JSON.parse(readFileSync(join(tmp, "package.json"), "utf8"))
  p2.name = scoped
  p2.publishConfig = { access: "public", registry: REGISTRY }
  p2.scripts = { ...(p2.scripts || {}) }
  delete p2.scripts.prepublishOnly
  delete p2.scripts.prepack
  writeFileSync(join(tmp, "package.json"), JSON.stringify(p2, null, 2) + "\n")

  try {
    const out = sh("npm", ["publish", "--access", "public", "--registry", REGISTRY], {
      cwd: tmp,
      env: { ...process.env, NODE_AUTH_TOKEN: tok },
    })
    console.log(ok(`  ✓ ${scoped}@${pkg.version}`))
    if (/warn/.test(out)) console.log(dim(out.trim().split("\n").slice(-2).join(" ")))
  } catch (e) {
    console.log(bad(`  ✗ ${scoped}: ${String(e.stderr || e.message).split("\n").slice(0, 3).join(" ")}`))
  } finally {
    sh("rm", ["-rf", tmp])
  }
}

console.log(dim("\nпроверка: npm view @rustemmustafingovua-byte/lumen-chain --registry=https://registry.npmjs.org/"))
