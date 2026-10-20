#!/usr/bin/env node
/**
 * docs.mjs — generates the real documentation page for every project.
 * One shared layout, per-project content: features, usage, options, internals, FAQ.
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

const WORKSPACE = join(homedir(), "workspace")
const OWNER = "rustemmustafingovua-byte"

const P = {
  "opencode-free-stack": {
    accent: "#3fb950",
    title: "opencode-free-stack",
    lede: "Route every request to a model that costs $0 — and fall back automatically when a provider runs dry.",
    intro:
      "Free model tiers do not fail randomly. They fail in three specific ways: a per-minute cap, a daily token pool, and a model weight that drains that pool two to four times faster than the token count suggests. This package knows all three and treats them as what they are — a routing problem, not a crash.",
    features: [
      ["Registry of free models", "28 models across OpenCode Zen, GitHub Copilot, BeatAPI and APInex, with their real limits."],
      ["RPM limiter", "Sliding window per provider, so a 429 is waited out instead of retried into."],
      ["Pool accounting", "Tokens are charged as tokens x weight, so the router knows when a provider is done for the day."],
      ["Fallback router", "402, 429, auth and upstream errors are classified, and the request moves to the next free model."],
      ["OpenCode plugin", "Continues the same turn on another model when the current one is out of quota."],
      ["Self-refreshing registry", "models.json is rebuilt every six hours from the live catalogues."],
    ],
    usage: [
      ["List everything", "ofs models"],
      ["What is configured", "ofs status"],
      ["The order that would be used", "ofs chain"],
      ["Send one prompt", 'ofs route "explain quicksort"'],
    ],
    internals: [
      "Build a chain: the preferred model of each provider first, then its other free models.",
      "Wait out the provider's RPM limit with a sliding window.",
      "Send, then classify the failure: rate_limit, quota_exhausted, auth, upstream.",
      "Charge the daily pool as tokens x weight and remember the result.",
    ],
    faq: [
      ["Why did my run stop with 'Free 10M tokens used'?", "That is APInex's daily pool, spent as tokens x model weight. It resets at 00:00 UTC, and the plugin will move the request to another provider on its own."],
      ["Do I need an account anywhere?", "No. Every provider here works with a free key or no key at all."],
      ["Can I add my own provider?", "Yes: one entry in src/providers.js. Nothing else changes."],
    ],
  },
  "free-web-mcp": {
    accent: "#2f81f7",
    title: "free-web-mcp",
    lede: "Web search and page reading for AI agents, with zero API credits.",
    intro:
      "Web search for agents is usually metered per call, which quietly decides whether an agent can browse at all. This server gives it the web for free: r.jina.ai renders any page into clean markdown, and Wikipedia, Hacker News and GitHub cover the rest.",
    features: [
      ["Any page as markdown", "r.jina.ai handles JavaScript pages, paywalls-free reads and long documents."],
      ["Wikipedia", "Summaries and search in Russian or English."],
      ["Hacker News", "Algolia search with points, authors and links."],
      ["GitHub", "Repositories, code and issues, with the token when it is present."],
      ["Full web search", "Adds Jina Search when a free Jina key is set."],
      ["Charge per call", "--price 0.001 serves it over x402: USDC on Base, signature verified."],
    ],
    usage: [
      ["As an MCP server", "free-web-mcp"],
      ["Over HTTP", "free-web-mcp serve --port 8788"],
      ["As a paid endpoint", "free-web-mcp serve --price 0.001"],
      ["In OpenCode", '{ "mcp": { "free-web": { "type": "local", "command": ["free-web-mcp"], "enabled": true } } }'],
    ],
    internals: [
      "The stdio server speaks MCP; the HTTP server exposes the same operations as JSON.",
      "A paid instance answers 402 with the x402 terms and verifies the EIP-3009 signature before serving.",
      "Results from the web are untrusted data, never instructions.",
    ],
    faq: [
      ["Do I need a key?", "No. GITHUB_TOKEN is optional and only raises the rate limit; JINA_API_KEY enables full web search."],
      ["Is it really free?", "Yes: the sources are free to call, and the hosted version is priced per call in USDC."],
      ["Can I self-host it and charge for it?", "Yes: run serve --price 0.001 and put it behind any tunnel."],
    ],
  },
  "agent-x402": {
    accent: "#a371f7",
    title: "agent-x402",
    lede: "Pay per API call in USDC on Base — with a spend policy a prompt injection cannot bypass.",
    intro:
      "x402 turns a 402 into a signed USDC transfer, which means an agent can buy inference without an account. It also means an agent can spend money. This is the client that pays, and the policy that decides whether it may.",
    features: [
      ["x402 v2, exact scheme", "EIP-3009 transferWithAuthorization, USDC on Base, 15-minute validity window."],
      ["Spend policy", "Daily cap, per-request cap, payment count, payee allow-list, blocked contracts, per-network cap."],
      ["Policy outside the model", "The rules are enforced in code before anything is signed."],
      ["Any endpoint", "The client is protocol-level, not vendor-specific."],
      ["MCP server", "x402-balance, x402-quote, x402-pay and x402-policy as agent tools."],
      ["Audit trail", "Every payment is recorded with its amount, model and time."],
    ],
    usage: [
      ["Create a wallet", "ax402 new"],
      ["See the balance", "ax402 balance"],
      ["Price a call", "ax402 quote https://api.venice.ai/api/v1/chat/completions"],
      ["Pay for a call", 'ax402 pay https://api.venice.ai/api/v1/chat/completions \'{"model":"claude-haiku-5-5","messages":[{"role":"user","content":"hi"}]}\''],
      ["Read the spend", "ax402 policy"],
    ],
    internals: [
      "Request the endpoint: a 402 comes back with the price, the network and the payee.",
      "Check the policy: caps, allow-list and blocked contracts are evaluated before signing.",
      "Sign the transfer with EIP-3009 and retry with the payment attached.",
      "Record the spend so the daily budget stays honest.",
    ],
    faq: [
      ["Is a payment reversible?", "No. x402 payments are final on-chain. Test with a small amount."],
      ["Where is the key stored?", "In ~/.config/agent-x402/wallet.json, mode 600. The library never writes it and never logs it."],
      ["Which networks work?", "Base today; the Solana variant is on the roadmap."],
    ],
  },
  "mcp-doctor": {
    accent: "#3fb950",
    title: "mcp-doctor",
    lede: "Health check for MCP servers — and the reason they are broken.",
    intro:
      "An MCP server that fails to start, points at a moved binary or lost its key does not raise an error; your agent just stops calling tools. This probes every server you configured, lists its tools, measures the latency and names the failure.",
    features: [
      ["stdio and streamable HTTP", "Both transports are probed with a real MCP handshake."],
      ["Failure taxonomy", "spawn, handshake, timeout, auth, empty — not a stack trace."],
      ["Reads your config", "Every enabled server in ~/.config/opencode/opencode.jsonc."],
      ["CI friendly", "--json and exit code 1 when a server is broken."],
    ],
    usage: [
      ["Everything in your config", "mcp-doctor"],
      ["One remote server", "mcp-doctor --url https://host/mcp"],
      ["One stdio server", 'mcp-doctor --cmd "npx -y some-mcp-server"'],
      ["In CI", "mcp-doctor --json"],
    ],
    internals: [
      "Each server is started or dialled and the MCP handshake is completed.",
      "The tool list is fetched, and an empty list is treated as a finding of its own.",
      "Failures are classified by their message, so the report says what to fix.",
    ],
    faq: [
      ["Does it change anything?", "No. It only starts and reads."],
      ["Will it hang on a broken server?", "No: every probe has a timeout."],
    ],
  },
  "mcp-proxy": {
    accent: "#2f81f7",
    title: "mcp-proxy",
    lede: "One endpoint, many MCP servers, with keys, limits and logs.",
    intro:
      "A shared MCP endpoint needs things a single server does not: one client key, a rate limit per client, a log you can read afterwards, and the ability to replay a call that misbehaved. This is that layer.",
    features: [
      ["One client key", "A single Bearer token in front of every backend."],
      ["Per-client limits", "Sliding window with Retry-After on the 429."],
      ["Append-only log", "Who called what, how long it took, what failed."],
      ["Replay", "Re-run a recorded call with /replay/<id>."],
      ["Routing", "Pick the backend per request with ?server=name."],
    ],
    usage: [
      ["Start it", "mcp-proxy --servers servers.json --key $MCP_PROXY_KEY --port 8790"],
      ["Health and stats", "curl localhost:8790/health"],
      ["Recent calls", "curl localhost:8790/logs?n=20"],
      ["Replay a call", "curl -X POST localhost:8790/replay/<id>"],
    ],
    internals: [
      "Authorise, then rate-limit, then route, then log the outcome.",
      "The backend transport is injected, which is what makes the logic testable.",
    ],
    faq: [
      ["Which MCP servers can it front?", "Any that speak MCP over stdio or streamable HTTP."],
      ["Does it log prompts?", "No: it logs method, path, client, duration and status."],
    ],
  },
  "tool-schema-lint": {
    accent: "#a371f7",
    title: "tool-schema-lint",
    lede: "Lint MCP tool schemas before your agent misuses them.",
    intro:
      "Agents call tools wrongly because the schema left room for interpretation. This checks the specific things that cause it: a missing description, an input nobody explained, an optional parameter with no default, a string that should have been an enum — and how many tokens the whole tool set costs.",
    features: [
      ["Ten real rules", "Not style: the checks that actually change call behaviour."],
      ["Score per tool set", "Errors, warnings and the token cost of the schemas."],
      ["Suggested rewrites", "A description that names the required input."],
      ["Context cost", "Which tool definitions eat the context of every request."],
    ],
    usage: [
      ["Lint a file", "tool-schema-lint tools.json"],
      ["From a pipe", "tool-schema-lint --stdin < tools.json"],
      ["With rewrites", "tool-schema-lint tools.json --suggest"],
    ],
    internals: [
      "Every tool is scored against the rule set, with duplicates detected across the list.",
      "The token estimate of each schema is added up — that is the part people are surprised by.",
    ],
    faq: [
      ["What counts as an error?", "A missing description and a duplicate tool name. Everything else is a warning."],
      ["Does it work on other schemas?", "Anything shaped like an MCP tool list works."],
    ],
  },
  "prompt-budget": {
    accent: "#f0883e",
    title: "prompt-budget",
    lede: "What does your system prompt actually cost on every single request?",
    intro:
      "Every request re-sends the system prompt, the tool schemas and the rules file. On a metered model that is the dominant cost; on a free tier it is what burns the daily pool. This measures all of it before you ship it.",
    features: [
      ["Token estimate", "Rules file, code blocks, every section."],
      ["Tool schemas", "Which tools eat the context."],
      ["Cost per request and per session", "With your own prices."],
      ["Actionable advice", "What to cut, what to move into a skill."],
    ],
    usage: [
      ["Measure a rules file", "prompt-budget AGENTS.md"],
      ["Include the tools", "prompt-budget AGENTS.md --tools tools.json --calls 50"],
      ["Custom prices", "prompt-budget AGENTS.md --price-in 0.1 --price-out 0.5"],
    ],
    internals: [
      "The file is split into sections; each section is measured separately.",
      "Tool schemas are measured as JSON, which is what actually reaches the model.",
      "The verdict compares the total against what a serious agent needs.",
    ],
    faq: [
      ["Is the token count exact?", "It is an estimate, and it is accurate enough to compare two versions of a prompt."],
      ["What is a good number?", "Under 4000 tokens per request is lean; over 10000 is heavy."],
    ],
  },
  "agent-cost-guard": {
    accent: "#db61a2",
    title: "agent-cost-guard",
    lede: "A budget in front of any OpenAI-compatible endpoint.",
    intro:
      "An agent loop is unbounded by nature: it retries, it re-reads files, it calls tools in circles. This proxy puts a wall around it — a token budget, a spend budget, a round-trip cap and a latency ceiling — in front of any endpoint that speaks OpenAI.",
    features: [
      ["Token budget", "Per session, checked before every request."],
      ["Spend budget", "Priced per model, in US dollars."],
      ["Round-trip cap", "Stops tool-call storms before they cost you."],
      ["Latency ceiling", "A slow upstream cannot stall the agent forever."],
      ["Spend report", "Per model, per session, at /report."],
    ],
    usage: [
      ["Start the guard", "agent-cost-guard --upstream https://api.example.com/v1 --port 8791"],
      ["Point the agent at it", "export OPENAI_BASE_URL=http://127.0.0.1:8791/v1"],
      ["Tag the session", "export OPENAI_DEFAULT_HEADERS='{\"x-session-id\":\"my-session\"}'"],
      ["Read the report", "curl localhost:8791/report?id=my-session"],
    ],
    internals: [
      "The budget is checked before the upstream is called.",
      "Usage is recorded after the response, priced with the model table.",
      "Over the budget the proxy answers 429 or 402 instead of spending more.",
    ],
    faq: [
      ["Does it work with any provider?", "Any OpenAI-compatible endpoint, including the free tiers."],
      ["Can I set a per-model price?", "Yes: --prices points at a JSON file."],
    ],
  },
  "opencode-doctor": {
    accent: "#3fb950",
    title: "opencode-doctor",
    lede: "Audit an OpenCode install in one command.",
    intro:
      "A broken OpenCode install rarely says why. This audits it in one pass: does the config parse, which providers actually have credentials, is a whitelist hiding everything, are paid models still in the picker, do the MCP servers point at files that exist.",
    features: [
      ["Config validation", "JSONC with comments and trailing commas."],
      ["Credential audit", "Environment, auth.json and {file:} references."],
      ["Picker audit", "How many models are visible, how many of them cost money."],
      ["Asset inventory", "MCP servers, skills, agents, commands and plugins."],
      ["A score", "so two installs can be compared."],
    ],
    usage: [
      ["Audit the default install", "opencode-doctor"],
      ["Another config", "opencode-doctor --config ./opencode.jsonc"],
      ["Machine readable", "opencode-doctor --json"],
    ],
    internals: [
      "The config is parsed with a JSONC-tolerant reader.",
      "Every provider is checked for a key in the environment, in auth.json or in a {file:} reference.",
      "The MCP section is checked for local commands that point at missing files.",
    ],
    faq: [
      ["Is it read-only?", "Yes. It never writes to your config."],
      ["Does it need the network?", "No, unless you add --probe."],
    ],
  },
  "free-tier-tracker": {
    accent: "#2f81f7",
    title: "free-tier-tracker",
    lede: "Know your free quota before it runs out.",
    intro:
      "Free tiers do not warn you: the model just answers 402 in the middle of a run. This keeps a local ledger of what each provider has left, learns from the failures you already hit, and tells the agent which provider to stop using.",
    features: [
      ["Local ledger", "Tokens used, failures and exhaustion per provider."],
      ["Learns from failures", "Recognises the 402 and 429 messages of the real tiers."],
      ["Warnings", "The agent is told which provider to avoid."],
      ["Pool probe", "watch checks the APInex pool in a single request."],
    ],
    usage: [
      ["Status", "free-tier-tracker status"],
      ["Report a failure", 'free-tier-tracker note "Free 10M tokens used"'],
      ["Record usage", "free-tier-tracker spend apinex 12000"],
      ["Probe the pool", "free-tier-tracker watch"],
    ],
    internals: [
      "The ledger is a small JSON file in ~/.config/free-tier-tracker.",
      "The daily counters reset with the UTC day, like the tiers themselves.",
    ],
    faq: [
      ["Where is the data?", "~/.config/free-tier-tracker/state.json. Nothing leaves the machine."],
      ["How does it know the limits?", "The limits are in the registry; the usage is what you tell it."],
    ],
  },
  "x402-priceboard": {
    accent: "#a371f7",
    title: "x402-priceboard",
    lede: "The price list of x402 endpoints, without paying anything.",
    intro:
      "Every x402 server answers the first request with the price, the network and the payee. This asks a list of endpoints for those terms, normalises them and prints a price board. No wallet, no key, no payment.",
    features: [
      ["Reads the 402 terms", "Price, network, asset and payee."],
      ["Normalised networks", "Base, Ethereum and Solana in one column."],
      ["Cheapest first", "The board sorts by what a call actually costs."],
      ["Free endpoints too", "A 200 means no payment is needed at all."],
    ],
    usage: [
      ["One endpoint", "x402-priceboard https://api.venice.ai/api/v1/chat/completions"],
      ["A list", "x402-priceboard --file endpoints.txt"],
      ["For a README", "x402-priceboard --file endpoints.txt --markdown"],
    ],
    internals: [
      "The probe sends one request and reads the payment-required header.",
      "The header is base64 JSON, decoded and normalised into rows.",
    ],
    faq: [
      ["Does it pay anything?", "No. It never sends a payment."],
      ["Why does the price differ per network?", "Some servers accept Base and Solana with different fees."],
    ],
  },
  "prompt-injection-guard": {
    accent: "#db61a2",
    title: "prompt-injection-guard",
    lede: "Find the instructions hidden in the files your agent reads by itself.",
    intro:
      "Agents read rules files, skill definitions, tool descriptions and documentation without a human in the loop. Anything that looks like an instruction, hides text or carries an embedded command is a risk. This scans those places.",
    features: [
      ["Ten patterns", "Instruction overrides, exfiltration attempts, role spoofing."],
      ["Invisible characters", "Zero-width and bidirectional control characters."],
      ["Directory scanning", "Rules, skills, configs and documentation."],
      ["Sanitising", "Strip comments and invisible characters."],
    ],
    usage: [
      ["One file", "prompt-injection-guard AGENTS.md"],
      ["A whole directory", "prompt-injection-guard --dir ~/.config/opencode"],
      ["Clean it", "prompt-injection-guard --sanitise AGENTS.md"],
    ],
    internals: [
      "Each pattern is matched over the whole text and counted.",
      "The first hit keeps an excerpt so you can see it in context.",
    ],
    faq: [
      ["Are there false positives?", "Yes: a security test file can look like an attack. The severity ordering helps."],
      ["Does it execute anything?", "Never. It only reads."],
    ],
  },
  "readme-doctor": {
    accent: "#f0883e",
    title: "readme-doctor",
    lede: "Why nobody is using your repository — checked in one command.",
    intro:
      "A README is the product page. This audits the things that decide whether someone installs it: a working install line, a visible demo, a license, resolvable links, closed code fences and a first paragraph that says what the thing does.",
    features: [
      ["Eleven checks", "Install, usage, license, badges, links, fences, placeholders."],
      ["Broken link detection", "Relative links are resolved against the repository."],
      ["A score", "so two READMEs can be compared."],
      ["Concrete fixes", "not a checklist, the next line to write."],
    ],
    usage: [
      ["Audit a repository", "readme-doctor ."],
      ["Machine readable", "readme-doctor . --json"],
    ],
    internals: [
      "The README is parsed into sections so the biggest parts can be pointed at.",
      "Relative links are resolved on disk; code fences are counted for balance.",
    ],
    faq: [
      ["Is the score objective?", "It is a checklist, and checklists are objective."],
      ["Does it check the code?", "No. Only the README and the files it references."],
    ],
  },
}

function page(p, slug) {
  const f = (rows) => rows.map(([a, b]) => `<div class="card"><b>${a}</b><span>${b}</span></div>`).join("\n")
  const u = (rows) =>
    rows
      .map(
        ([a, b]) =>
          `<div class="row"><code>${a}</code><span>${b}</span></div>`,
      )
      .join("\n")
  const faq = (rows) =>
    rows
      .map(
        ([q, a]) =>
          `<details><summary>${q}</summary><p>${a}</p></details>`,
      )
      .join("\n")

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${p.title} — ${p.lede}</title>
<meta name="description" content="${p.lede}">
<meta property="og:title" content="${p.title}">
<meta property="og:description" content="${p.lede}">
<meta property="og:image" content="https://raw.githubusercontent.com/${OWNER}/${slug}/main/docs/social-preview.png">
<style>
  :root{--accent:${p.accent};--bg:#0a0c10;--panel:#0f141a;--fg:#e6edf3;--muted:#8b949e;--line:#1d222a}
  *{box-sizing:border-box}
  body{margin:0;background:radial-gradient(900px 500px at 10% -10%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 60%), var(--bg);
       color:var(--fg);font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,sans-serif}
  .wrap{max-width:920px;margin:0 auto;padding:64px 24px 100px}
  .chip{display:inline-block;padding:6px 13px;border-radius:999px;background:color-mix(in srgb, var(--accent) 16%, transparent);
        border:1px solid color-mix(in srgb, var(--accent) 40%, transparent);color:var(--accent);font-size:13px;font-weight:600;margin-bottom:20px}
  h1{font-size:clamp(32px,5vw,46px);letter-spacing:-.03em;line-height:1.08;margin:0 0 14px}
  h2{font-size:14px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:52px 0 16px}
  p{color:#b6bec8;margin:0 0 14px}
  .lede{font-size:19px;color:#c9d1d9;margin:0 0 20px}
  .grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(250px,1fr))}
  .card{border:1px solid var(--line);border-radius:12px;padding:16px 18px;background:var(--panel)}
  .card b{display:block;margin-bottom:5px}
  .card span{color:var(--muted);font-size:14px}
  .row{display:grid;grid-template-columns:minmax(190px,auto) 1fr;gap:14px;align-items:baseline;padding:10px 0;border-bottom:1px solid var(--line)}
  .row code{background:#11161d;border:1px solid var(--line);padding:4px 9px;border-radius:7px;font-size:13.5px;white-space:pre-wrap}
  .row span{color:#b6bec8;font-size:15px}
  details{border:1px solid var(--line);border-radius:10px;padding:12px 16px;background:var(--panel);margin-bottom:8px}
  summary{cursor:pointer;font-weight:600}
  details p{margin:10px 0 2px}
  ol{padding-left:20px;color:#b6bec8}
  ol li{margin:6px 0}
  .cta{display:inline-block;background:var(--accent);color:#06120a;font-weight:700;padding:11px 20px;border-radius:10px;text-decoration:none;margin:8px 10px 0 0}
  .cta.ghost{background:transparent;color:var(--fg);border:1px solid var(--line)}
  footer{margin-top:60px;padding-top:22px;border-top:1px solid var(--line);color:#6e7681;font-size:13.5px;display:flex;gap:16px;flex-wrap:wrap}
</style></head><body><div class="wrap">
<span class="chip">${p.title}</span>
<h1>${p.lede}</h1>
<p class="lede">${p.intro}</p>
<a class="cta" href="https://github.com/${OWNER}/${slug}">View on GitHub</a>
<a class="cta ghost" href="https://www.npmjs.com/package/${slug}">npm</a>
<a class="cta ghost" href="https://github.com/${OWNER}/${slug}#readme">README</a>

<h2>What it does</h2>
<div class="grid">
${f(p.features)}
</div>

<h2>Usage</h2>
${u(p.usage)}

<h2>How it works</h2>
<ol>
${p.internals.map((x) => `  <li>${x}</li>`).join("\n")}
</ol>

<h2>Questions</h2>
${faq}

<footer>
  <span>${p.title} · MIT</span>
  <a href="https://github.com/${OWNER}/${slug}">source</a>
  <a href="https://github.com/${OWNER}/${slug}/issues">issues</a>
  <span>USDC on Base: <code>0x8aC6a229f254980CCd3Dd35CF5E1B7c08880B40E</code></span>
</footer>
</div></body></html>
`
}

let n = 0
for (const [slug, p] of Object.entries(P)) {
  const dir = join(WORKSPACE, slug, "docs")
  if (!existsSync(dir)) {
    console.log(`  – ${slug}: нет docs/`)
    continue
  }
  writeFileSync(join(dir, "index.html"), page(p, slug))
  n++
}
console.log(`docs written: ${n}`)
