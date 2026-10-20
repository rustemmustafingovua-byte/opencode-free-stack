#!/usr/bin/env node
/**
 * add-funding.mjs — единая точка «поддержать проект» во всех репозиториях.
 *
 * Добавляет:
 *   - FUNDING.yml (кнопка Sponsor на GitHub);
 *   - раздел Support с адресом кошелька в README (если его ещё нет).
 *
 *   node scripts/add-funding.mjs            # все репозитории
 *   node scripts/add-funding.mjs --dry      # только показать
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

const WORKSPACE = join(homedir(), "workspace")
const OWNER = "rustemmustafingovua-byte"
/** Куда приходят донаты — кошелёк владельца (тот же, что в MetaMask). */
export const WALLET = "0x8aC6a229f254980CCd3Dd35CF5E1B7c08880B40E"

const REPOS = [
  "opencode-free-stack", "free-web-mcp", "agent-x402", "agent-browser-mcp",
  "mcp-doctor", "mcp-proxy", "tool-schema-lint", "prompt-budget",
  "agent-cost-guard", "opencode-doctor", "free-tier-tracker", "x402-priceboard",
  "prompt-injection-guard", "readme-doctor", "lumen-chain",
]

const dry = process.argv.includes("--dry")
const FUNDING = `# Funding
github: ${OWNER}
ethereum: ${WALLET}
`

const SUPPORT = `
## Support

Every tool here is MIT and free. If it saved you time, you can support the work:

- **USDC (Base):** \`${WALLET}\`
- **GitHub Sponsors:** https://github.com/sponsors/${OWNER}

Paid tiers of the hosted services are billed per call in USDC (x402) — no accounts, no keys.
`

for (const slug of REPOS) {
  const dir = join(WORKSPACE, slug)
  if (!existsSync(join(dir, "README.md"))) continue
  const changed = []

  const fy = join(dir, ".github", "FUNDING.yml")
  if (!existsSync(fy) || readFileSync(fy, "utf8") !== FUNDING) {
    if (!dry) writeFileSync(fy, FUNDING)
    changed.push("FUNDING.yml")
  }

  const readme = join(dir, "README.md")
  const s = readFileSync(readme, "utf8")
  if (!s.includes("## Support")) {
    const marker = s.includes("## License")
    const next = marker
      ? s.replace("## License", SUPPORT.trim() + "\n\n## License")
      : s.trimEnd() + "\n" + SUPPORT
    if (!dry) writeFileSync(readme, next)
    changed.push("README: Support")
  }

  console.log(`${slug.padEnd(24)} ${changed.length ? changed.join(", ") : "уже есть"}`)
}
