#!/usr/bin/env node
import { publish } from "./scaffold.mjs"

const SPECS = {
  "mcp-doctor": { topics: ["mcp","model-context-protocol","debugging","devtools","opencode","claude-code","agents","healthcheck"], desc: "Check that your MCP servers actually work — and say why they do not." },
  "mcp-proxy": { topics: ["mcp","proxy","rate-limiting","observability","openai-compatible","agents","security"], desc: "One endpoint, many MCP servers, with keys, limits and logs." },
  "tool-schema-lint": { topics: ["mcp","linting","tool-use","schema","agents","llm","developer-tools"], desc: "Lint MCP tool schemas before your agent misuses them." },
  "prompt-budget": { topics: ["prompt-engineering","tokens","cost-optimization","context-window","agents","llm","budget"], desc: "What does your system prompt actually cost on every single request?" },
  "agent-cost-guard": { topics: ["cost-control","proxy","agents","budget","openai-compatible","llm","guardrails"], desc: "A budget in front of any OpenAI-compatible endpoint." },
  "opencode-doctor": { topics: ["opencode","doctor","diagnostics","config","devtools","agents","audit"], desc: "Audit an OpenCode install in one command." },
  "free-tier-tracker": { topics: ["free-tier","quota","limits","agents","cost-control","monitoring","llm"], desc: "Know your free quota before it runs out." },
  "x402-priceboard": { topics: ["x402","usdc","base","solana","pricing","agents","micropayments","crypto"], desc: "The price list of x402 endpoints, without paying anything." },
  "prompt-injection-guard": { topics: ["security","prompt-injection","agents","llm","scanner","sanitizer","audit"], desc: "Find the instructions hidden in the files your agent reads by itself." },
  "readme-doctor": { topics: ["readme","documentation","open-source","developer-tools","audit","docs","github"], desc: "Why nobody is using your repository — checked in one command." },
}

const only = process.argv[2]
for (const [slug, s] of Object.entries(SPECS)) {
  if (only && slug !== only) continue
  try {
    await publish(slug, s.topics, s.desc)
  } catch (e) {
    console.log(`  ✗ ${slug}: ${e.message}`)
  }
}
