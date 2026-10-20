#!/usr/bin/env node
/**
 * attach-tarballs.mjs — publishes the npm tarball of every package as a
 * GitHub release asset, so the tools can be installed without an npm account:
 *
 *   npm i https://github.com/rustemmustafingovua-byte/<repo>/releases/download/v0.1.0/<repo>-0.1.0.tgz
 */
import { execFileSync } from "node:child_process"
import { readFileSync, existsSync, rmSync, unlinkSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

const WORKSPACE = join(homedir(), "workspace")
const OWNER = "rustemmustafingovua-byte"
const KEY = join(homedir(), ".config", "opencode", "secrets", "github.key")
const TOKEN = readFileSync(KEY, "utf8").trim()
const H = { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" }

const REPOS = [
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

for (const slug of REPOS) {
  const dir = join(WORKSPACE, slug)
  if (!existsSync(dir)) continue
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"))
  let tgz
  try {
    tgz = execFileSync("npm", ["pack", "--silent"], { cwd: dir, encoding: "utf8" }).trim().split("\n").pop()
  } catch (e) {
    console.log(`  – ${slug}: pack failed`)
    continue
  }
  const file = join(dir, tgz)
  // release id
  const rel = await (await fetch(`https://api.github.com/repos/${OWNER}/${slug}/releases/tags/v0.1.0`, { headers: H })).json()
  if (!rel?.id) {
    console.log(`  – ${slug}: нет релиза`)
    continue
  }
  // already attached?
  if ((rel.assets || []).some((a) => a.name === tgz)) {
    console.log(`  · ${slug}: ${tgz} уже приложен`)
    rmSync(file, { force: true })
    continue
  }
  const body = await (await fetch(
    `https://uploads.github.com/repos/${OWNER}/${slug}/releases/${rel.id}/assets?name=${encodeURIComponent(tgz)}`,
    {
      method: "POST",
      headers: { ...H, "Content-Type": "application/octet-stream" },
      body: readFileSync(file),
    },
  )).json()
  if (body?.browser_download_url) {
    console.log(`  ✓ ${slug}: ${tgz} → ${body.browser_download_url}`)
  } else {
    console.log(`  ✗ ${slug}: ${JSON.stringify(body).slice(0, 120)}`)
  }
  rmSync(file, { force: true })
}
console.log("tarballs attached")
