# Launch kit

One post per repo, value-first, each written for the people who would actually
use it. Post manually (HN, Reddit, X) — never auto-post, never cross-post the
same text twice.

---

## opencode-free-stack

**Title:** Free-model router for OpenCode: it knows every free tier's limits and falls back when one runs dry

> Free AI tiers don't fail randomly — they fail in three specific ways: an
> RPM cap, a daily token pool, and a per-model weight multiplier that burns
> that pool 2–4× faster than you'd expect. Every agent run that dies with
> "Free 10M tokens used" is the same bug.
>
> I built `opencode-free-stack`: a registry of 28 genuinely free models across
> OpenCode Zen, GitHub Copilot, BeatAPI and APInex, with the real limits baked
> in. It paces itself to each provider's RPM, tracks the daily pool as
> `tokens × weight`, and when a provider says 402/429 it quietly moves the
> request to the next free model — in the same turn.
>
> ```bash
> npm i -g opencode-free-stack
> ofs status     # what's configured, how much quota is left
> ofs route "..." # send a prompt through the fallback chain
> ```
>
> MIT, no key required for the library. Repo: https://github.com/rustemmustafingovua-byte/opencode-free-stack

## free-web-mcp

**Title:** Web search for AI agents with zero API credits (r.jina.ai + Wikipedia + HN + GitHub as one MCP server)

> Web search for agents usually means a metered API. If your agent browses a
> few dozen pages a session, that meter decides whether the agent is usable at
> all.
>
> `free-web-mcp` gives an agent the web for $0: r.jina.ai renders any page
> into clean markdown, plus Wikipedia, Hacker News and GitHub search — behind
> one MCP server, no key, no credits.
>
> ```jsonc
> { "mcp": { "free-web": { "type": "local", "command": ["free-web-mcp"], "enabled": true } } }
> ```
>
> Repo: https://github.com/rustemmustafingovua-byte/free-web-mcp

## agent-x402

**Title:** x402 payments for agents, with a spend policy a prompt injection can't bypass

> x402 lets an agent pay per API call in USDC with no account and no card. It
> also means an agent can spend money — and a model that can sign payments is
> one prompt injection away from draining a wallet.
>
> `agent-x402` is the missing layer: the client that pays (EIP-3009 USDC on
> Base), and a policy that decides whether it may — daily cap, per-request
> cap, payee allow-list, per-network cap — enforced in code, outside the model.
>
> ```js
> const client = new X402Client({ privateKey, policy: new SpendPolicy({ dailyUsd: 5 }) })
> await client.fetch(url, { method: "POST", body })
> ```
>
> Repo: https://github.com/rustemmustafingovua-byte/agent-x402
