#!/usr/bin/env node
/**
 * standardize.mjs — add the community files every serious repository has:
 * CONTRIBUTING.md, SECURITY.md, CHANGELOG.md, issue and PR templates.
 */
import { writeFileSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

const WORKSPACE = join(homedir(), "workspace")
const OWNER = "rustemmustafingovua-byte"

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

const CONTRIBUTING = (name) => `# Contributing

Thanks for helping make agent setups work.

## Ground rules

- plain JavaScript, ESM, no build step
- no runtime dependencies unless the tool genuinely needs them
- every behaviour change comes with a test
- comments explain **why**, not **what**

## Getting set up

\`\`\`bash
git clone https://github.com/${OWNER}/${name}.git
cd ${name}
npm install
npm test
\`\`\`

## Adding a provider / source / rule

Most of these tools are one declarative file plus a router:

| Tool | Where the data lives |
|---|---|
| opencode-free-stack | \`src/providers.js\` |
| free-web-mcp | \`src/index.js\` (one function per source) |
| agent-x402 | \`src/x402.js\` (protocol) + \`src/policy.js\` (limits) |
| prompt-injection-guard | \`PATTERNS\` in \`src/index.js\` |
| readme-doctor | \`CHECKS\` in \`src/index.js\` |

Adding an entry should not require touching any other file.

## Pull requests

1. open an issue first for anything larger than a fix
2. keep the diff focused
3. make sure \`npm test\` and \`npm run lint\` pass
4. describe what changes for the user, not how the code works

## Bounties

Issues labelled 💰 Reward can be funded by anyone with \`/reward <amount>\` (Opire) or
via [Algora](https://algora.io). The money is paid to the person whose PR gets
merged — never to the repo owner. That is the point: it buys contributors,
reviews and attention.
`

const SECURITY = (name) => `# Security policy

## Reporting a vulnerability

Use **Security → Report a vulnerability** on GitHub. Please do not open a public
issue for a suspected flaw in the security-relevant code.

## What this tool handles

${
  name === "agent-x402"
    ? `This tool holds a private key and signs USDC payments. Treat it as a hot wallet.

- the key stays in the process that signs; it is never logged and never written by the library
- the spend policy is enforced **before** signing — daily cap, per-request cap, payment count, payee allow-list, blocked contracts, per-network cap
- the policy is the boundary: a model that can call the tool still cannot raise a cap
- x402 payments are irreversible on-chain — test with a small amount first`
    : name === "prompt-injection-guard"
      ? `This tool reads files and reports patterns. It never executes what it finds.

- findings contain short excerpts; treat them as untrusted
- \`--sanitise\` strips HTML comments and invisible characters — review the output before using it`
      : `This tool reads local files or calls public APIs. It does not execute the content it reads.

- no credentials are written to disk by the tool
- keys come from the environment and are forwarded to the service that needs them
- output from fetched pages is untrusted data, never instructions`
}

## Supported versions

| Version | Supported |
|---|---|
| 0.1.x | ✅ |
`

const CHANGELOG = (name) => `# Changelog

All notable changes to this project follow
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- see the open issues — anything labelled 💰 Reward can be picked up

## [0.1.0] - 2026-10-20

### Added
- first release of \`${name}\`
- MIT licensed, CI on Node 20/22/24
`

const BUG_ISSUE = `name: 🐛 Bug
description: Something does not behave as documented.
labels: ["🐛 Bug"]
body:
  - type: input
    id: what
    attributes:
      label: What happened
      description: What you expected, and what you got instead.
    validations:
      required: true
  - type: textarea
    id: repro
    attributes:
      label: Reproduction
      description: The smallest command or snippet that shows it.
    validations:
      required: true
  - type: input
    id: env
    attributes:
      label: Version and environment
      description: Output of \`node -v\` and the tool version.
`

const FEATURE_ISSUE = `name: ✨ Feature
description: An idea or a gap you hit.
labels: ["✨ Feature"]
body:
  - type: textarea
    id: problem
    attributes:
      label: Problem
      description: What are you trying to do that is hard today?
    validations:
      required: true
  - type: textarea
    id: proposal
    attributes:
      label: Proposal
      description: What you think should happen, and what it should look like.
`

const BOUNTY_ISSUE = `name: 💰 Reward
description: Anyone can fund this with "/reward <amount>" (Opire) or via Algora. The reward is paid to the merged PR, not to the repo owner.
labels: ["💰 Reward"]
body:
  - type: input
    id: amount
    attributes:
      label: Suggested reward (USDC)
      placeholder: "25"
  - type: textarea
    id: acceptance
    attributes:
      label: Acceptance criteria
      description: What must be true for this to be done? Be specific.
    validations:
      required: true
`

const PR_TEMPLATE = `name: Pull request
description: Keep it focused — one change, one explanation.
body:
  - type: textarea
    id: what
    attributes:
      label: What changes
      description: What is different after this PR? Write it for the user, not the reviewer.
    validations:
      required: true
  - type: textarea
    id: why
    attributes:
      label: Why
      description: Which problem does this solve? Link an issue if there is one.
  - type: checkboxes
    id: checks
    attributes:
      label: Checklist
      options:
        - label: npm test passes
          required: true
        - label: npm run lint passes
          required: true
        - label: README updated if behaviour changed
          required: false
`

for (const name of REPOS) {
  const dir = join(WORKSPACE, name)
  if (!existsSync(dir)) {
    console.log(`  – ${name}: нет каталога`)
    continue
  }
  writeFileSync(join(dir, "CONTRIBUTING.md"), CONTRIBUTING(name))
  writeFileSync(join(dir, "SECURITY.md"), SECURITY(name))
  writeFileSync(join(dir, "CHANGELOG.md"), CHANGELOG(name))
  const tpl = join(dir, ".github", "ISSUE_TEMPLATE")
  mkdirSync(tpl, { recursive: true })
  writeFileSync(join(tpl, "bug.yml"), BUG_ISSUE)
  writeFileSync(join(tpl, "feature.yml"), FEATURE_ISSUE)
  writeFileSync(join(tpl, "bounty.yml"), BOUNTY_ISSUE)
  mkdirSync(join(dir, ".github"), { recursive: true })
  writeFileSync(join(dir, ".github", "PULL_REQUEST_TEMPLATE.md"), PR_TEMPLATE)
  console.log(`  ✓ ${name}`)
}
console.log("standardized")
