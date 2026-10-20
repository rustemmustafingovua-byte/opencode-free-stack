# Strategy — monetising free-AI tooling for agents

> Goal: turn a set of genuinely useful free-AI tools into a self-funding stream
> that pays out in USDC, using GitHub as the distribution channel.

## 1. Why this can work

**Demand is proven.** "Run AI for free" and "pay per API call with crypto" are
two of the most searched-for topics in the agent ecosystem right now. Both have
a structural problem that our tools remove:

| Pain | Who pays to fix it |
|---|---|
| Free tiers are unreliable (quota pools, RPM caps, 402s) | agents that need a fallback |
| Web search for agents costs credits per call | agents that browse a lot |
| Agents that can pay can be drained by one prompt injection | anyone running agents on a budget |
| Nobody knows which free model is actually free today | everyone |

**The monetisation rail fits the buyer.** Our buyer is an agent, not a human
with a card. x402 lets an agent pay per call in USDC on Base, with **no
account and no KYC** — the buyer needs a wallet, and that is it. No subscription
churn, no invoicing, no support tickets.

**Stars are the funnel, not the product.** Stars do not pay. They buy
distribution: more npm downloads, more installs, more inbound API calls, and
therefore more x402 payments.

## 2. The portfolio

Three repositories, one funnel. Each is useful on its own and points at the
next.

| Repo | Role | Monetisation |
|---|---|---|
| [`opencode-free-stack`](https://github.com/rustemmustafingovua-byte/opencode-free-stack) | top of funnel: the free-model router | hosted model registry (x402 per call) + USDC donations |
| [`free-web-mcp`](https://github.com/rustemmustafingovua-byte/free-web-mcp) | the product with a natural price: free web for agents | hosted MCP, $0.001/call, paid tier for bulk |
| [`agent-x402`](https://github.com/rustemmustafingovua-byte/agent-x402) | the payment rail other agents need | hosted relay (take rate) + paid policy service |

Why these three and not five: each one is already **finished and tested**
(7 / 6 / 5 passing tests). Shipping working software beats shipping a plan.

## 3. Monetisation rails

1. **x402 per call (main rail).** Price the hosted registry and hosted MCP at
   `0.001 USDC` per call. A single agent that browses 100 pages a day spends
   $0.10/day. Cheap enough to be impulse, frequent enough to accumulate.
2. **USDC donations.** Every README carries the wallet
   `0x8aC6a229f254980CCd3Dd35CF5E1B7c08880B40E` (Base). `FUNDING.yml` wires it
   into GitHub's Sponsor button. Zero cost, zero effort, compounding trust.
3. **Bounties on our own repos (Opire / Algora).** Anyone can fund an issue
   with `/reward 25`; the money goes to the merged PR, never to us. That is
   the point: it buys contributors, reviews and stars. Once revenue exists, we
   fund our own issues and the loop compounds.
4. **Paid tier.** The registry API and MCP get an SLA tier (higher limits,
   priority routing) sold in USDC via x402.

## 4. Distribution (the actual star engine)

| Channel | Action | Cost |
|---|---|---|
| GitHub topics + awesome-lists | every repo | free |
| npm | `npm publish` after one `npm login` | free |
| MCP registries | Smithery, mcp.so, OpenCode plugin marketplace | free |
| GitHub Pages docs + demo GIF | one page per repo | free |
| Show HN / Reddit / X / Discord | value-first launch posts, one per repo | free |
| Cross-links | the three repos link to each other | free |

**Discipline:** no mass-follow, no comment spam, no drive-by promo posts. One
genuinely useful launch post per repo, written for the people who would
actually use it.

## 5. Automation

- `ci.yml` — tests on every push (Node 20/22/24)
- `release.yml` — tag → npm publish
- `sync-models.yml` — refreshes the free-model registry every 6 hours
- `growth.mjs` — daily digest: stars, issues, downloads, x402 volume, balance

## 6. Honest numbers

- **Stars**: 0 → 100 is a slow grind. Expect tens, not thousands, in the
  first month. The 5 existing repos of this account have 0 stars each — that
  is the baseline to beat, and the reason each new repo ships with CI, tests,
  a demo and a topic set from day one.
- **Money**: the first USDC will not come from stars. It will come from the
  hosted services once they have a few users. Realistically: first small
  payment in weeks, meaningful revenue only if one service finds a niche
  (e.g. an agent that browses thousands of pages a day).
- **The leverage** is in the hosted service: the same code that is free on
  GitHub earns per call when hosted. That is the whole business model.

## 7. Risks

| Risk | Mitigation |
|---|---|
| Free tiers change or vanish | the registry refreshes itself; fallbacks are automatic |
| x402 endpoints disappear | the client is protocol-level, not vendor-specific |
| Community reacts badly to self-promotion | value-first posts, disclose affiliation, no spam |
| npm account needed for publishing | one `npm login` by the owner |
| We are the only user of our own tools | publish usage numbers, dogfood openly |

## 8. Next 14 days

- [x] `opencode-free-stack` — router, registry, CLI, CI, release `v0.1.0`
- [x] `agent-x402` — x402 client, spend policy, CLI, CI
- [x] `free-web-mcp` — MCP server, HTTP mode, tests, CI
- [ ] `npm login` (owner) → publish all three packages
- [ ] register in Smithery / mcp.so / OpenCode plugin marketplace
- [ ] GitHub Pages docs + demo GIF per repo
- [ ] host `free-web-mcp` and `opencode-free-stack` registry with a price
- [ ] launch posts: HN Show HN + Reddit + X, one per repo
- [ ] fund the first bounty on our own repo with the first revenue
- [ ] `growth.mjs` daily digest + monthly metrics review
