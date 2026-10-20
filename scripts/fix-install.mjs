#!/usr/bin/env node
/**
 * fix-install.mjs — честные инструкции по установке во всех репозиториях.
 *
 * 4 пакета уже опубликованы на npmjs.org — там остаётся `npm i -g <name>`.
 * Остальные 10 публикуются в GitHub Packages и, главное, ставятся из tarball
 * релиза без токена и без npm-логина:
 *
 *   npm i -g https://github.com/<owner>/<repo>/releases/download/v0.1.0/<repo>-0.1.0.tgz
 *
 * Скрипт не трогает ничего, кроме блока "## Install".
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

const WORKSPACE = join(homedir(), "workspace")
const OWNER = "rustemmustafingovua-byte"

const ON_NPM = new Set(["mcp-doctor", "mcp-proxy", "agent-cost-guard", "readme-doctor"])
const REPOS = [
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
const dim = (s) => `\x1b[2m${s}\x1b[0m`

function block(slug, version) {
  const tgz = `https://github.com/${OWNER}/${slug}/releases/download/v${version}/${slug}-${version}.tgz`
  if (ON_NPM.has(slug)) {
    return `## Install

\`\`\`bash
npm i -g ${slug}
\`\`\`

<details>
<summary>Без npm-логина — из tarball релиза</summary>

\`\`\`bash
npm i -g ${tgz}
\`\`\`

</details>
`
  }
  return `## Install

\`\`\`bash
# tarball из релиза: без токена и без npm-логина
npm i -g ${tgz}
\`\`\`

<details>
<summary>Через GitHub Packages</summary>

\`\`\`bash
npm i -g @${OWNER}/${slug} --registry=https://npm.pkg.github.com
\`\`\`

</details>
`
}

for (const slug of REPOS) {
  const file = join(WORKSPACE, slug, "README.md")
  if (!existsSync(file)) {
    console.log(dim(`${slug}: нет README.md`))
    continue
  }
  const s = readFileSync(file, "utf8")
  const m = s.match(/^## Install\s*$([\s\S]*?)(?=^## )/m)
  if (!m) {
    console.log(dim(`${slug}: секция Install не найдена`))
    continue
  }
  const pkgFile = join(WORKSPACE, slug, "package.json")
  const version = existsSync(pkgFile) ? JSON.parse(readFileSync(pkgFile, "utf8")).version : "0.1.0"
  const next = s.replace(m[0], block(slug, version))
  if (next !== s) {
    writeFileSync(file, next)
    console.log(ok(`${slug}: блок Install обновлён (v${version})`))
  }
}
