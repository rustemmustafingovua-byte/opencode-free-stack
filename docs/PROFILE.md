<div align="center">

# rustemmustafingovua-byte

**Building tools that make free AI actually usable — and charge for them in USDC.**

[opencode-free-stack](https://github.com/rustemmustafingovua-byte/opencode-free-stack) ·
[free-web-mcp](https://github.com/rustemmustafingovua-byte/free-web-mcp) ·
[agent-x402](https://github.com/rustemmustafingovua-byte/agent-x402)

</div>

---

## What I build

| Project | Problem it solves | Monetisation |
|---|---|---|
| **[opencode-free-stack](https://github.com/rustemmustafingovua-byte/opencode-free-stack)** | free model tiers fail in three specific ways (RPM, daily pools, weight) — the router knows all of them and falls back automatically | hosted model registry, priced per call |
| **[free-web-mcp](https://github.com/rustemmustafingovua-byte/free-web-mcp)** | web search for agents costs credits per call | hosted MCP, $0.001 / call |
| **[agent-x402](https://github.com/rustemmustafingovua-byte/agent-x402)** | an agent that can sign payments is one prompt injection away from an empty wallet | hosted relay, policy service |

## Why crypto

The buyer of an agent tool is an agent — and agents pay with x402: USDC on
Base, per call, no account, no card, no KYC. That fits a market where
subscriptions do not work.

## Principles

- **Free first.** Every project has a genuinely free path; paid tiers add
  limits, not features.
- **Honest limits.** Free tiers fail in documented ways. Name them instead of
  pretending they do not exist.
- **Policy outside the model.** Anything an agent can trigger is capped in code.
- **MIT, forever.** The business model is hosting, not the licence.

## Support

Donations in USDC on Base:

```
0x8aC6a229f254980CCd3Dd35CF5E1B7c08880B40E
```

## Stack

TypeScript · Node · MCP · OpenAI-compatible APIs · viem · x402 · USDC · Base · Solana · GitHub Actions
