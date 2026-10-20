#!/usr/bin/env node
/**
 * cli-polish.mjs — gives every CLI in the portfolio the same professional shell:
 *   --help / -h   usage, options, examples
 *   --version / -V
 *   consistent exit codes
 * The help text is written per project; the rest is identical.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

const WORKSPACE = join(homedir(), "workspace")

const PROJECTS = {
  "opencode-free-stack": {
    bin: "bin/ofs.js",
    name: "ofs",
    tagline: "Free-model router for OpenCode.",
    usage: ["ofs models", "ofs status", "ofs chain", 'ofs route "explain quicksort"'],
    options: [
      ["models", "list every known free model, grouped by provider"],
      ["status", "which providers are configured and how much quota is left"],
      ["chain", "print the fallback order that would be used"],
      ["route <prompt>", "send one prompt through the fallback chain"],
    ],
    extra: ["Environment: OPENCODE_API_KEY, GITHUB_TOKEN, BEATAPI_API_KEY, APINEX_API_KEY"],
  },
  "free-web-mcp": {
    bin: "bin/free-web-mcp.js",
    name: "free-web-mcp",
    tagline: "Web search and page reading for agents, with zero API credits.",
    usage: [
      "free-web-mcp                 run the MCP server on stdio",
      "free-web-mcp serve           run an HTTP server",
      "free-web-mcp serve --price 0.001   charge 0.001 USDC per call on Base",
    ],
    options: [
      ["serve", "HTTP mode instead of the stdio MCP server"],
      ["--port <n>", "port for the HTTP server (default 8788)"],
      ["--price <usd>", "charge per call in USDC (x402, Base); the signature is verified"],
    ],
    extra: ["Environment: JINA_API_KEY (optional, enables full web search), GITHUB_TOKEN (optional)"],
  },
  "agent-x402": {
    bin: "bin/ax402.js",
    name: "ax402",
    tagline: "x402 micropayments for AI agents, with a spend policy.",
    usage: [
      "ax402 new                     create an agent wallet",
      "ax402 balance                 USDC balance on Base",
      'ax402 quote <url> [METHOD]    what would this call cost',
      'ax402 pay <url> [json]        call the endpoint, paying with USDC',
      "ax402 policy                  show the spend report",
    ],
    options: [
      ["new", "create a wallet in ~/.config/agent-x402/wallet.json (mode 600)"],
      ["balance", "read the USDC balance of the agent wallet"],
      ["quote", "perform the request, read the 402 terms, pay nothing"],
      ["pay", "perform the request and pay it (policy enforced before signing)"],
      ["policy", "show the daily spend, the number of payments and the per-model breakdown"],
    ],
    extra: ["The private key never leaves the process that signs. x402 payments are irreversible."],
  },
  "mcp-doctor": {
    bin: "bin/mcp-doctor.js",
    name: "mcp-doctor",
    tagline: "Health check for MCP servers.",
    usage: [
      "mcp-doctor                          read ~/.config/opencode/opencode.jsonc",
      "mcp-doctor --url https://host/mcp   probe one remote server",
      'mcp-doctor --cmd "npx -y server"    probe one stdio server',
    ],
    options: [
      ["--config <path>", "config file to read"],
      ["--url <url>", "probe a single remote MCP server"],
      ["--cmd <command>", "probe a single stdio MCP server"],
      ["--timeout <ms>", "handshake timeout (default 15000)"],
      ["--json", "machine-readable output"],
    ],
    extra: ["Exit code 1 when at least one server is broken."],
  },
  "mcp-proxy": {
    bin: "bin/mcp-proxy.js",
    name: "mcp-proxy",
    tagline: "One endpoint, many MCP servers, with keys, limits and logs.",
    usage: [
      "mcp-proxy --servers servers.json --key $MCP_PROXY_KEY --port 8790",
    ],
    options: [
      ["--servers <file>", "JSON map of server name -> {url} or {command}"],
      ["--key <bearer>", "require this client key (default: $MCP_PROXY_KEY)"],
      ["--port <n>", "port to listen on (default 8790)"],
      ["--rpm <n>", "per-client request limit (default 60)"],
    ],
    extra: [
      "Endpoints:",
      "  GET  /health                 status and stats",
      "  GET  /logs?n=20              recent calls",
      "  POST /replay/<id>            replay a recorded call",
      "  POST /?server=<name>         proxy a request to one backend",
    ],
  },
  "tool-schema-lint": {
    bin: "bin/tool-schema-lint.js",
    name: "tool-schema-lint",
    tagline: "Lint MCP tool schemas before your agent misuses them.",
    usage: [
      "tool-schema-lint tools.json",
      "tool-schema-lint --stdin < tools.json",
      "tool-schema-lint tools.json --suggest",
    ],
    options: [
      ["--stdin", "read the tool list from standard input"],
      ["--suggest", "print a rewritten description for every tool with findings"],
    ],
    extra: ["Exit code 1 when a tool has an error-level finding."],
  },
  "prompt-budget": {
    bin: "bin/prompt-budget.js",
    name: "prompt-budget",
    tagline: "What does your system prompt actually cost on every request?",
    usage: [
      "prompt-budget AGENTS.md",
      "prompt-budget AGENTS.md --tools tools.json --calls 50",
    ],
    options: [
      ["--tools <file>", "also measure the tool schemas"],
      ["--calls <n>", "requests per session (default 50)"],
      ["--price-in <usd>", "input price per 1M tokens (default 3)"],
      ["--price-out <usd>", "output price per 1M tokens (default 15)"],
    ],
    extra: [],
  },
  "agent-cost-guard": {
    bin: "bin/agent-cost-guard.js",
    name: "agent-cost-guard",
    tagline: "A budget in front of any OpenAI-compatible endpoint.",
    usage: [
      "agent-cost-guard --upstream https://api.example.com/v1 --port 8791",
      "# then point the agent at http://127.0.0.1:8791/v1",
    ],
    options: [
      ["--upstream <url>", "the OpenAI-compatible endpoint to protect (required)"],
      ["--port <n>", "port to listen on (default 8791)"],
      ["--max-tokens <n>", "token budget per session (default 200000)"],
      ["--max-spend <usd>", "spend budget per session (default 5)"],
      ["--max-rounds <n>", "round-trip cap per session (default 60)"],
    ],
    extra: [
      "Endpoints:",
      "  GET /health              status and per-session stats",
      "  GET /report?id=<session>  the spend report of one session",
      "",
      "Give the agent a session id: header  x-session-id: <id>",
    ],
  },
  "opencode-doctor": {
    bin: "bin/opencode-doctor.js",
    name: "opencode-doctor",
    tagline: "Audit an OpenCode install in one command.",
    usage: [
      "opencode-doctor",
      "opencode-doctor --config ~/.config/opencode/opencode.jsonc --json",
    ],
    options: [
      ["--config <path>", "config file to audit (default ~/.config/opencode/opencode.jsonc)"],
      ["--json", "machine-readable output"],
    ],
    extra: ["Exit code 1 when the install has an error-level finding."],
  },
  "free-tier-tracker": {
    bin: "bin/free-tier-tracker.js",
    name: "free-tier-tracker",
    tagline: "Know your free quota before it runs out.",
    usage: [
      "free-tier-tracker status",
      'free-tier-tracker note "Free 10M tokens used"',
      "free-tier-tracker spend apinex 12000",
      "free-tier-tracker reset apinex",
      "free-tier-tracker watch",
    ],
    options: [
      ["status", "what is left of every known free tier"],
      ["note <message>", "learn a limit failure from a message"],
      ["spend <provider> <tokens>", "record normal usage"],
      ["reset <provider>", "clear the exhausted flag"],
      ["watch", "probe the APInex pool in one request"],
    ],
    extra: ["State is kept in ~/.config/free-tier-tracker/state.json."],
  },
  "x402-priceboard": {
    bin: "bin/x402-priceboard.js",
    name: "x402-priceboard",
    tagline: "The price list of x402 endpoints, without paying anything.",
    usage: [
      "x402-priceboard https://api.venice.ai/api/v1/chat/completions",
      "x402-priceboard --file endpoints.txt --markdown",
    ],
    options: [
      ["--file <path>", "read the endpoint list from a file"],
      ["--post", "send POST instead of GET when probing"],
      ["--markdown", "render the board as Markdown"],
    ],
    extra: [],
  },
  "prompt-injection-guard": {
    bin: "bin/prompt-injection-guard.js",
    name: "prompt-injection-guard",
    tagline: "Find the instructions hidden in the files your agent reads by itself.",
    usage: [
      "prompt-injection-guard AGENTS.md",
      "prompt-injection-guard --dir ~/.config/opencode",
      "prompt-injection-guard --sanitise AGENTS.md",
    ],
    options: [
      ["--dir <path>", "scan a directory tree (max depth 3)"],
      ["--sanitise", "print the file with comments and invisible characters removed"],
    ],
    extra: ["Exit code 1 when a critical finding is present."],
  },
  "readme-doctor": {
    bin: "bin/readme-doctor.js",
    name: "readme-doctor",
    tagline: "Why nobody is using your repository — checked in one command.",
    usage: ["readme-doctor .", "readme-doctor . --json"],
    options: [
      ["--json", "machine-readable output"],
    ],
    extra: ["Exit code 1 when the README has an error-level finding."],
  },
}

function helpText(p, version) {
  const lines = []
  lines.push(`${p.name} — ${p.tagline}`)
  lines.push("")
  lines.push("USAGE")
  for (const u of p.usage) lines.push(`  ${u}`)
  lines.push("")
  lines.push("COMMANDS / OPTIONS")
  const width = Math.max(...p.options.map((o) => o[0].length))
  for (const [name, desc] of p.options) lines.push(`  ${name.padEnd(width)}  ${desc}`)
  if (p.extra.length) {
    lines.push("")
    for (const e of p.extra) lines.push(e)
  }
  lines.push("")
  lines.push("MIT · https://github.com/rustemmustafingovua-byte")
  return lines.join("\n")
}

for (const [slug, p] of Object.entries(PROJECTS)) {
  const dir = join(WORKSPACE, slug)
  const file = join(dir, p.bin)
  if (!existsSync(file)) {
    console.log(`  – ${slug}: нет ${p.bin}`)
    continue
  }
  let src = readFileSync(file, "utf8")
  if (src.includes("__CLI_HELP__")) {
    console.log(`  · ${slug}: уже отполирован`)
    continue
  }
  const version = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).version
  const help = helpText(p, version)
  const block = `
// --- CLI shell: --help / --version -------------------------------------------
const HELP = ${JSON.stringify(help)}
const VERSION = ${JSON.stringify(version)}
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(HELP)
  process.exit(0)
}
if (process.argv.includes("--version") || process.argv.includes("-V")) {
  console.log(VERSION)
  process.exit(0)
}
`
  // вставляем блок сразу после строки с shebang
  const lines = src.split("\n")
  let idx = 0
  if (lines[0].startsWith("#!")) idx = 1
  // после shebang идёт блок импортов — вставляем после последнего import
  let lastImport = idx
  for (let i = idx; i < lines.length; i++) {
    if (/^import\s/.test(lines[i]) || /^} from "/.test(lines[i])) lastImport = i
    if (lines[i].trim() === "" && lastImport > idx) break
  }
  lines.splice(lastImport + 1, 0, block)
  writeFileSync(file, lines.join("\n"))
  console.log(`  ✓ ${slug}`)
}
console.log("polished")
