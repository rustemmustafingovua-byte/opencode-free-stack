#!/usr/bin/env node
/**
 * scaffold.mjs — общий каркас для всех проектов портфеля.
 *
 *   node scripts/scaffold.mjs <slug> "<name>" "<description>" "<accent>" "<tagline>"
 *
 * Создаёт: package.json, LICENSE, .gitignore, .editorconfig, CI, README, docs/
 * И потом публикует: repo + topics + release + issue.
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync, chmodSync } from "node:fs"
import { join } from "node:path"
import { execFileSync } from "node:child_process"
import { homedir } from "node:os"

const WORKSPACE = join(homedir(), "workspace")
const OWNER = "rustemmustafingovua-byte"

const FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif`
const MONO = `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`

export function scaffold(spec) {
  const { slug, name, description, accent, tagline, install, usage, features, tools, keywords } = spec
  const dir = join(WORKSPACE, slug)
  mkdirSync(join(dir, "src"), { recursive: true })
  mkdirSync(join(dir, "bin"), { recursive: true })
  mkdirSync(join(dir, "test"), { recursive: true })
  mkdirSync(join(dir, ".github", "workflows"), { recursive: true })
  mkdirSync(join(dir, "docs"), { recursive: true })

  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify(
      {
        name: slug,
        version: "0.1.0",
        description,
        type: "module",
        license: "MIT",
        bin: { [spec.binName || slug]: `bin/${spec.binName || slug}.js` },
        exports: { ".": "./src/index.js" },
        engines: { node: ">=20" },
        keywords,
        files: ["bin", "src", "README.md", "LICENSE"],
        scripts: { test: "node --test test/*.test.js", lint: "node --check src/index.js" },
        repository: { type: "git", url: `https://github.com/${OWNER}/${slug}.git` },
        bugs: { url: `https://github.com/${OWNER}/${slug}/issues` },
        homepage: `https://github.com/${OWNER}/${slug}`,
      },
      null,
      2,
    ) + "\n",
  )

  writeFileSync(
    join(dir, "LICENSE"),
    `MIT License\n\nCopyright (c) 2026 ${OWNER}\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n`,
  )
  writeFileSync(join(dir, ".gitignore"), "node_modules\n.DS_Store\n*.log\n.env\n")
  writeFileSync(join(dir, ".editorconfig"), "root = true\n\n[*]\ncharset = utf-8\nend_of_line = lf\ninsert_final_newline = true\nindent_style = space\nindent_size = 2\n")
  writeFileSync(
    join(dir, ".github", "workflows", "ci.yml"),
    `name: CI
on:
  push:
    branches: [main]
  pull_request:
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [20, 22, 24]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ matrix.node }}
      - run: npm install
      - run: npm run lint
      - run: npm test
`,
  )
  writeFileSync(
    join(dir, ".github", "workflows", "pages.yml"),
    `name: Docs
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: docs
      - id: deployment
        uses: actions/deploy-pages@v4
`,
  )

  // README
  const featureRows = features.map((f) => `| **${f[0]}** | ${f[1]} |`).join("\n")
  const toolRows = (tools || []).map((t) => `| \`${t[0]}\` | ${t[1]} |`).join("\n")
  writeFileSync(
    join(dir, "README.md"),
    `<div align="center">

<img src="docs/social-preview.png" alt="${name}" width="100%">

# ${name}

**${tagline}**

[![CI](https://github.com/${OWNER}/${slug}/actions/workflows/ci.yml/badge.svg)](https://github.com/${OWNER}/${slug}/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/${slug}?color=cb3837&logo=npm)](https://www.npmjs.com/package/${slug})
[![license](https://img.shields.io/badge/license-MIT-8b949e?logo=opensourceinitiative)](./LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D20-3c873a?logo=node.js)](https://nodejs.org)
[![paid](https://img.shields.io/badge/USDC-0x8aC6a229f254980CCd3Dd35CF5E1B7c08880B40E-2775ca?logo=ethereum)](https://base.org)

[**Docs**](https://${OWNER}.github.io/${slug}/) · [Issues](https://github.com/${OWNER}/${slug}/issues) · [Discussions](https://github.com/${OWNER}/${slug}/discussions)

</div>

---

${description}

## Install

\`\`\`bash
${install}
\`\`\`

## What it does

| | |
|---|---|
${featureRows}

${toolRows ? `| Tool | What it does |\n|---|---|\n${toolRows}\n` : ""}
## Usage

\`\`\`bash
${usage}
\`\`\`

## Part of a portfolio

| Project | What it does |
|---|---|
| [\`opencode-free-stack\`](https://github.com/${OWNER}/opencode-free-stack) | route to free models, fall back automatically |
| [\`free-web-mcp\`](https://github.com/${OWNER}/free-web-mcp) | web search for agents, zero credits |
| [\`agent-x402\`](https://github.com/${OWNER}/agent-x402) | pay per API call in USDC with a spend policy |

## Donate

MIT, forever. USDC on Base:

\`\`\`
0x8aC6a229f254980CCd3Dd35CF5E1B7c08880B40E
\`\`\`

## License

MIT © ${OWNER}
`,
  )

  // docs site
  writeFileSync(
    join(dir, "docs", "index.html"),
    `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${name} — ${tagline}</title>
<meta name="description" content="${description.replace(/"/g, "&quot;")}">
<style>
  :root{--accent:${accent};--bg:#0a0c10;--fg:#e6edf3;--muted:#8b949e;--line:#21262d}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.65 ${FONT}}
  .wrap{max-width:860px;margin:0 auto;padding:72px 28px 96px}
  h1{font-size:42px;letter-spacing:-.025em;margin:0 0 12px}
  .sub{color:#c9d1d9;font-size:20px;margin:0 0 26px}
  p{color:#b6bec8}
  pre{background:#11161d;border:1px solid var(--line);border-radius:12px;padding:16px 18px;overflow:auto;font:13.5px/1.6 ${MONO}}
  code{font-family:${MONO};font-size:.93em}
  p code{background:#161b22;border:1px solid var(--line);padding:1.5px 6px;border-radius:6px}
  a{color:var(--accent)}
  table{width:100%;border-collapse:collapse;margin:18px 0;font-size:14.5px}
  th,td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--line)}
  th{color:var(--muted)}
  .cta{display:inline-block;background:var(--accent);color:#07100a;font-weight:700;padding:11px 20px;border-radius:10px;text-decoration:none;margin:8px 10px 0 0}
  .cta.ghost{background:transparent;color:var(--fg);border:1px solid var(--line)}
  footer{margin-top:60px;padding-top:24px;border-top:1px solid var(--line);color:#6e7681;font-size:14px}
</style></head><body><div class="wrap">
<h1>${name}</h1>
<p class="sub">${tagline}</p>
<p>${description}</p>
<h2>Install</h2>
<pre><code>${install}</code></pre>
<h2>Usage</h2>
<pre><code>${usage}</code></pre>
<a class="cta" href="https://github.com/${OWNER}/${slug}">View on GitHub</a>
<a class="cta ghost" href="https://github.com/${OWNER}/${slug}/releases">Releases</a>
<footer>${name} · MIT · USDC on Base: <code>0x8aC6a229f254980CCd3Dd35CF5E1B7c08880B40E</code></footer>
</div></body></html>
`,
  )

  return dir
}

export function gitInit(dir) {
  execFileSync("git", ["init", "-q"], { cwd: dir })
  execFileSync("git", ["config", "user.name", OWNER], { cwd: dir })
  execFileSync("git", ["config", "user.email", `${OWNER}@users.noreply.github.com`], { cwd: dir })
}

export function token() {
  const f = join(homedir(), ".config", "opencode", "secrets", "github.key")
  if (existsSync(f)) return readFileSync(f, "utf8").trim()
  return process.env.GITHUB_TOKEN || ""
}

export async function publish(slug, topics, description) {
  const tok = token()
  const H = { Authorization: `Bearer ${tok}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" }
  const dir = join(WORKSPACE, slug)

  // repo
  let res = await fetch(`https://api.github.com/user/repos`, { method: "POST", headers: H, body: JSON.stringify({
    name: slug, description, private: false, has_issues: true, has_discussions: true, topics, auto_init: false,
  }) })
  if (res.status !== 201 && res.status !== 422) {
    const body = (await res.text()).slice(0, 200)
    console.log(`  repo ${slug}: HTTP ${res.status} (${body})`)
    throw new Error(`repo not created: HTTP ${res.status} ${body}`)
  }
  else await fetch(`https://api.github.com/repos/${OWNER}/${slug}`, { method: "PATCH", headers: H, body: JSON.stringify({ description, has_issues: true, has_discussions: true }) })
  // topics
  await fetch(`https://api.github.com/repos/${OWNER}/${slug}/topics`, {
    method: "PUT", headers: H, body: JSON.stringify({ names: topics }),
  })
  // pages
  await fetch(`https://api.github.com/repos/${OWNER}/${slug}/pages`, {
    method: "POST", headers: H, body: JSON.stringify({ build_type: "workflow", source: { branch: "main", path: "/" } }),
  })
  // labels
  for (const [n, c] of [["💰 Reward", "0x8a2be2"], ["🐛 Bug", "d73a4a"], ["✨ Feature", "a2eeef"], ["📚 Docs", "0075ca"]]) {
    await fetch(`https://api.github.com/repos/${OWNER}/${slug}/labels`, { method: "POST", headers: H, body: JSON.stringify({ name: n, color: c }) })
  }
  // git
  execFileSync("git", ["add", "-A"], { cwd: dir })
  try { execFileSync("git", ["commit", "-q", "-m", `feat: ${slug} — first release`], { cwd: dir }) } catch {}
  execFileSync("git", ["branch", "-M", "main"], { cwd: dir })
  try { execFileSync("git", ["remote", "remove", "origin"], { cwd: dir }) } catch {}
  execFileSync("git", ["remote", "add", "origin", `https://github.com/${OWNER}/${slug}.git`], { cwd: dir })
  const basic = Buffer.from(`x-access-token:${tok}`).toString("base64")
  execFileSync("git", ["-c", `http.extraheader=AUTHORIZATION: basic ${basic}`, "push", "-q", "-u", "origin", "main"], { cwd: dir })
  try { execFileSync("git", ["tag", "v0.1.0"], { cwd: dir }) } catch {}
  execFileSync("git", ["-c", `http.extraheader=AUTHORIZATION: basic ${basic}`, "push", "-q", "--tags"], { cwd: dir })
  // release
  await fetch(`https://api.github.com/repos/${OWNER}/${slug}/releases`, {
    method: "POST", headers: H, body: JSON.stringify({ tag_name: "v0.1.0", name: "v0.1.0 — first release", body: description, draft: false }),
  })
  console.log(`  ✓ ${slug} опубликован`)
}
