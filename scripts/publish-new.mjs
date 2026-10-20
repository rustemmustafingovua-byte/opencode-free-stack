#!/usr/bin/env node
/**
 * publish-new.mjs — scaffold, brand and publish the ten new projects.
 */
import { scaffold, gitInit, publish } from "./scaffold.mjs"
import { writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import { execFileSync } from "node:child_process"

const PROJECTS = [
  {
    slug: "mcp-doctor",
    name: "mcp-doctor",
    accent: "#3fb950",
    binName: "mcp-doctor",
    description:
      "MCP servers break silently: a wrong command, an expired key, a moved URL — and your agent just stops calling tools. mcp-doctor probes every server you configured, lists its tools, measures latency and tells you exactly what broke and how to fix it.",
    tagline: "Check that your MCP servers actually work — and say why they do not.",
    install: "npm i -g mcp-doctor",
    usage: "mcp-doctor\nmcp-doctor --url https://example.com/mcp\nmcp-doctor --json",
    features: [
      ["Probes stdio and streamable-HTTP servers", "starts the process, completes the MCP handshake, lists the tools"],
      ["Classifies the failure", "spawn / handshake / timeout / auth / empty — not a stack trace"],
      ["Reads your OpenCode config", "every enabled server in one pass, with latency"],
      ["Machine readable", "--json for CI"],
    ],
    topics: ["mcp", "model-context-protocol", "debugging", "devtools", "opencode", "claude-code", "agents", "healthcheck"],
  },
  {
    slug: "mcp-proxy",
    name: "mcp-proxy",
    accent: "#2f81f7",
    binName: "mcp-proxy",
    description:
      "One endpoint in front of many MCP servers. mcp-proxy adds the things a shared MCP endpoint needs and a single server does not: a client key, per-client rate limits, an append-only request log, replay of past calls, and routing by server name.",
    tagline: "One endpoint, many MCP servers, with keys, limits and logs.",
    install: "npm i -g mcp-proxy",
    usage: "mcp-proxy --servers servers.json --key $MCP_PROXY_KEY --port 8790",
    features: [
      ["A single client key", "one Bearer token for every backend"],
      ["Per-client rate limits", "sliding window, Retry-After on the 429"],
      ["Append-only request log", "who called what, how long it took, what failed"],
      ["Replay", "re-run a recorded call with /replay/<id>"],
    ],
    topics: ["mcp", "proxy", "rate-limiting", "observability", "openai-compatible", "agents", "security"],
  },
  {
    slug: "tool-schema-lint",
    name: "tool-schema-lint",
    accent: "#a371f7",
    binName: "tool-schema-lint",
    description:
      "Agents call tools wrongly because the schema is ambiguous. tool-schema-lint checks the things that cause that: a missing description, an input nobody explained, an optional parameter with no default, a string that should have been an enum, and a schema so big it eats the context.",
    tagline: "Lint MCP tool schemas before your agent misuses them.",
    install: "npm i -g tool-schema-lint",
    usage: "tool-schema-lint tools.json\ntool-schema-lint --stdin < tools.json\ntool-schema-lint tools.json --suggest",
    features: [
      ["Real rules, not style", "missing description, vague description, optional without default, free-form string"],
      ["A score per tool set", "errors, warnings and the token cost of the schemas"],
      ["Suggested rewrites", "a description that names the required input"],
      ["Context cost", "how many tokens the tool definitions add to every request"],
    ],
    topics: ["mcp", "linting", "tool-use", "schema", "agents", "llm", "developer-tools"],
  },
  {
    slug: "prompt-budget",
    name: "prompt-budget",
    accent: "#f0883e",
    binName: "prompt-budget",
    description:
      "Every request re-sends your system prompt, the tool schemas and the rules file. On a metered model that is the dominant cost; on a free tier it is what burns the daily pool. prompt-budget measures all of it before you ship it.",
    tagline: "What does your system prompt actually cost on every single request?",
    install: "npm i -g prompt-budget",
    usage: "prompt-budget AGENTS.md\nprompt-budget AGENTS.md --tools tools.json --calls 50",
    features: [
      ["Token estimate for rules files", "sections, code blocks, the expensive parts"],
      ["Token cost of tool schemas", "which tools eat the context"],
      ["Cost per request and per session", "with your own prices"],
      ["Actionable advice", "what to cut and what to move into a skill"],
    ],
    topics: ["prompt-engineering", "tokens", "cost-optimization", "context-window", "agents", "llm", "budget"],
  },
  {
    slug: "agent-cost-guard",
    name: "agent-cost-guard",
    accent: "#db61a2",
    binName: "agent-cost-guard",
    description:
      "An agent loop is unbounded by nature: it retries, it re-reads files, it calls tools in circles. agent-cost-guard is a proxy that puts a wall around it — token budget, spend budget, round-trip cap, latency ceiling — in front of any OpenAI-compatible endpoint.",
    tagline: "A budget in front of any OpenAI-compatible endpoint.",
    install: "npm i -g agent-cost-guard",
    usage:
      "agent-cost-guard --upstream https://api.example.com/v1 --port 8791\n# then point the agent at http://127.0.0.1:8791/v1",
    features: [
      ["Token budget per session", "a long context cannot run away"],
      ["Spend budget per session", "priced per model, in USD"],
      ["Round-trip cap", "stops tool-call storms"],
      ["A report of where it went", "per model, per session, at /report"],
    ],
    topics: ["cost-control", "proxy", "agents", "budget", "openai-compatible", "llm", "guardrails"],
  },
  {
    slug: "opencode-doctor",
    name: "opencode-doctor",
    accent: "#3fb950",
    binName: "opencode-doctor",
    description:
      "A broken OpenCode install rarely says why. opencode-doctor audits it in one command: does the config parse, which providers actually have credentials, is a whitelist hiding everything, are paid models still in the picker, do the MCP servers point at files that exist.",
    tagline: "Audit an OpenCode install in one command.",
    install: "npm i -g opencode-doctor",
    usage: "opencode-doctor\nopencode-doctor --config ~/.config/opencode/opencode.jsonc --json",
    features: [
      ["Config validation", "JSONC with comments and trailing commas"],
      ["Credential audit", "env, auth.json and {file:} references"],
      ["Picker audit", "how many models are visible, how many are paid"],
      ["Asset inventory", "MCP servers, skills, agents, commands, plugins"],
    ],
    topics: ["opencode", "doctor", "diagnostics", "config", "devtools", "agents", "audit"],
  },
  {
    slug: "free-tier-tracker",
    name: "free-tier-tracker",
    accent: "#2f81f7",
    binName: "free-tier-tracker",
    description:
      "Free tiers do not warn you: the model just answers 402 in the middle of a run. free-tier-tracker keeps a local ledger of what each provider has left, learns from the failures you already hit, and tells the agent to stop using a provider that is done for the day.",
    tagline: "Know your free quota before it runs out.",
    install: "npm i -g free-tier-tracker",
    usage:
      "free-tier-tracker status\nfree-tier-tracker note \"Free 10M tokens used\"\nfree-tier-tracker watch",
    features: [
      ["A local ledger per provider", "tokens used, failures, exhaustion"],
      ["Learns from real failures", "recognises 402 / 429 / quota messages"],
      ["Warnings before exhaustion", "the agent is told which provider to avoid"],
      ["A pool probe", "watch checks the APInex pool in one request"],
    ],
    topics: ["free-tier", "quota", "limits", "agents", "cost-control", "monitoring", "llm"],
  },
  {
    slug: "x402-priceboard",
    name: "x402-priceboard",
    accent: "#a371f7",
    binName: "x402-priceboard",
    description:
      "Every x402 server answers the first request with its price, network and payee. x402-priceboard asks a list of endpoints for those terms and prints a price board — no payment, no wallet, no key.",
    tagline: "The price list of x402 endpoints, without paying anything.",
    install: "npm i -g x402-priceboard",
    usage:
      "x402-priceboard https://api.venice.ai/api/v1/chat/completions\nx402-priceboard --file endpoints.txt --markdown",
    features: [
      ["Reads the 402 terms", "price, network, asset and payee"],
      ["Normalises networks", "Base, Ethereum, Solana"],
      ["Cheapest option per endpoint", "the board sorts by price"],
      ["Free endpoints too", "a 200 means no payment is needed"],
    ],
    topics: ["x402", "usdc", "base", "solana", "pricing", "agents", "micropayments", "crypto"],
  },
  {
    slug: "prompt-injection-guard",
    name: "prompt-injection-guard",
    accent: "#db61a2",
    binName: "prompt-injection-guard",
    description:
      "Agents read rules files, tool descriptions and documentation without a human in the loop. prompt-injection-guard scans the places an agent reads automatically for hidden instructions, invisible characters and embedded commands — and can sanitise them.",
    tagline: "Find the instructions hidden in the files your agent reads by itself.",
    install: "npm i -g prompt-injection-guard",
    usage:
      "prompt-injection-guard AGENTS.md\nprompt-injection-guard --dir ~/.config/opencode\nprompt-injection-guard --sanitise AGENTS.md",
    features: [
      ["Ten injection patterns", "override, exfiltration, hidden comments, role spoofing"],
      ["Invisible characters", "zero-width and bidi control characters"],
      ["Directory scanning", "rules, skills, configs, docs"],
      ["Sanitising mode", "strip comments and invisible characters"],
    ],
    topics: ["security", "prompt-injection", "agents", "llm", "scanner", "sanitizer", "audit"],
  },
  {
    slug: "readme-doctor",
    name: "readme-doctor",
    accent: "#f0883e",
    binName: "readme-doctor",
    description:
      "A README is the product page. readme-doctor audits the things that decide whether someone installs it: a working install line, a visible demo, a license, resolvable links, closed code fences and a first paragraph that says what the thing does.",
    tagline: "Why nobody is using your repository — checked in one command.",
    install: "npm i -g readme-doctor",
    usage: "readme-doctor .\nreadme-doctor . --json",
    features: [
      ["Eleven real checks", "install line, usage, license, badges, links, fences, placeholders"],
      ["Broken link detection", "relative links are resolved against the repo"],
      ["A score", "so two READMEs can be compared"],
      ["Concrete fixes", "not a checklist, the next line to write"],
    ],
    topics: ["readme", "documentation", "open-source", "developer-tools", "audit", "docs", "github"],
  },
]

const BROWSERS = [
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
]

function bannerHtml(p) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}
  body{margin:0;width:1280px;height:640px;overflow:hidden;background:
      radial-gradient(900px 520px at 8% -12%, ${p.accent}26, transparent 58%),
      radial-gradient(760px 460px at 96% 108%, ${p.accent}18, transparent 55%),
      #0a0c10;color:#e6edf3;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,sans-serif;
      display:flex;align-items:center;gap:52px;padding:0 68px}
  .left{width:600px}
  .chip{display:inline-block;padding:7px 14px;border-radius:999px;background:${p.accent}18;border:1px solid ${p.accent}44;color:${p.accent};font-size:13.5px;font-weight:600;margin-bottom:26px}
  h1{margin:0 0 14px;font-size:50px;letter-spacing:-.03em;font-weight:800;line-height:1.05}
  h1 em{font-style:normal;color:${p.accent}}
  .tag{font-size:23px;font-weight:600;color:#c9d1d9;margin:0 0 10px;line-height:1.3}
  .sub{font-size:18px;color:#8b949e;line-height:1.5;margin:0 0 24px}
  .code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:16.5px;color:#adbac7;background:#11161d;border:1px solid #2b333c;padding:11px 16px;border-radius:10px;display:inline-block}
  .code b{color:${p.accent}}
  .foot{margin-top:22px;font-size:14.5px;color:#6e7681;font-family:ui-monospace,Menlo,monospace}
</style></head><body>
  <div class="left">
    <span class="chip">${p.name}</span>
    <h1>${p.name.replace(/-(doctor|kit|board|guard|tracker|lint|budget|proxy)/, (m) => `<em>${m.slice(1)}</em>`).replace(/^([a-z-]*?)([a-z]+)$/, (m, a, b) => a + `<em>${b}</em>`)}</h1>
    <p class="tag">${p.tagline}</p>
    <p class="sub">${p.description.slice(0, 190)}…</p>
    <div class="code"><b>$</b> ${p.install}</div>
    <p class="foot">github.com/rustemmustafingovua-byte</p>
  </div>
</body></html>`
}

const browser = BROWSERS.find((b) => existsSync(b))
const only = process.argv[2]

for (const p of PROJECTS) {
  if (only && p.slug !== only) continue
  const dir = scaffold({
    slug: p.slug,
    name: p.name,
    description: p.description,
    accent: p.accent,
    tagline: p.tagline,
    install: p.install,
    usage: p.usage,
    features: p.features,
    tools: [],
    keywords: p.topics,
    binName: p.binName,
  })
  gitInit(dir)
  // banner
  if (browser) {
    const tmp = join(dir, "docs", "_b.html")
    writeFileSync(tmp, bannerHtml(p))
    try {
      execFileSync(
        browser,
        ["--headless", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
         `--screenshot=${join(dir, "docs", "social-preview.png")}`, "--window-size=1280,640", `file://${tmp}`],
        { stdio: "ignore" },
      )
    } catch {}
    try { rmSync(tmp) } catch {}
  }
  console.log(`scaffolded ${p.slug}`)
}
console.log("DONE")
