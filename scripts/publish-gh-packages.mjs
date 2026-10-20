#!/usr/bin/env node
/**
 * publish-gh-packages.mjs — публикация всех пакетов в GitHub Packages (npm-совместимый реестр).
 *
 * GitHub Packages не требует npm-токена: в CI используется встроенный GITHUB_TOKEN
 * с правом packages: write. Публикация запускается тегом pkg-v<version>.
 *
 *   node scripts/publish-gh-packages.mjs           # все пакеты
 *   node scripts/publish-gh-packages.mjs tool-schema-lint
 */
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

const WORKSPACE = join(homedir(), "workspace")
const TOKEN = readFileSync(join(homedir(), ".config/opencode/secrets/github.key"), "utf8").trim()
const OWNER = "rustemmustafingovua-byte"

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
  "lumen-chain",
]

const WORKFLOW = `name: Publish to GitHub Packages
on:
  push:
    tags: ["pkg-v*"]
permissions:
  contents: read
  packages: write
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://npm.pkg.github.com
      - run: npm install
      - name: Publish
        run: |
          npm pkg set name="@\${{ github.repository_owner }}/\${{ github.event.repository.name }}"
          npm publish --access public
        env:
          NODE_AUTH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`

const ok = (s) => `\x1b[32m${s}\x1b[0m`
const dim = (s) => `\x1b[2m${s}\x1b[0m`
const bad = (s) => `\x1b[31m${s}\x1b[0m`

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts })
}

function git(dir, args) {
  return sh("git", ["-C", dir, ...args])
}

function auth() {
  return `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${TOKEN}`).toString("base64")}`
}

const only = process.argv.slice(2)
const targets = only.length ? only : PACKAGES

for (const slug of targets) {
  const dir = join(WORKSPACE, slug)
  if (!existsSync(join(dir, "package.json"))) {
    console.log(bad(`${slug}: нет package.json — пропуск`))
    continue
  }
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"))
  const version = pkg.version || "0.1.0"
  const tag = `pkg-v${version}`

  // 1. workflow
  const wfDir = join(dir, ".github/workflows")
  mkdirSync(wfDir, { recursive: true })
  const wfPath = join(wfDir, "publish.yml")
  const needWrite = !existsSync(wfPath) || readFileSync(wfPath, "utf8") !== WORKFLOW
  if (needWrite) writeFileSync(wfPath, WORKFLOW)

  // 2. коммит + тег + пуш
  try {
    if (needWrite) {
      git(dir, ["add", ".github/workflows/publish.yml"])
      git(dir, ["commit", "-m", "ci: publish to GitHub Packages on pkg-v* tag"])
    }
    const tags = git(dir, ["tag", "-l", tag]).trim()
    if (!tags) {
      git(dir, ["tag", tag])
    }
    git(dir, ["push", "origin", "HEAD"])
    git(dir, ["push", "origin", tag])
    console.log(ok(`${slug} → ${tag} запушен`))
  } catch (e) {
    console.log(bad(`${slug}: ${String(e.stderr || e.message).split("\n")[0]}`))
  }
}

console.log(dim(`\nСмотри прогресс: https://github.com/${OWNER}?tab=repositories`))
