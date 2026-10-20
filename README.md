<div align="center">

# opencode-free-stack

**Free-model stack for [OpenCode](https://opencode.ai) — route every request to a model that costs you $0, fall back automatically when a provider runs dry, and keep an eye on your daily quotas.**

[![npm](https://img.shields.io/npm/v/opencode-free-stack)](https://www.npmjs.com/package/opencode-free-stack)
[![license](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![tests](https://img.shields.io/badge/tests-node--test-green)](./test)
[![paid](https://img.shields.io/badge/USDC-0x8aC6a229f254980CCd3Dd35CF5E1B7c08880B40E-8A2BE2)](https://base.org)

</div>

## Why

Free AI tiers look generous until you actually use them:

| Provider | Free models | The catch |
|---|---|---|
| **OpenCode Zen** | 10 | Served only from inside OpenCode |
| **GitHub Copilot** | 5 | ~50 premium requests/month, Claude blocked on free |
| **BeatAPI** | 5 | 1 request/min until you top up (10/min after) |
| **APInex** | 9 | 10M tokens/day, spent as `tokens × model weight` (2–4×) |
| **Venice AI** | paid | Claude from $0.10/1M via x402 USDC |

The failure mode is always the same: your agent picks one model, the provider answers `402 Free 10M tokens used` or `429`, and the run dies.

`opencode-free-stack` fixes that: a **fallback router** that knows every free model, its RPM cap and its daily pool — and quietly moves to the next one.

## Install

```bash
npm install -g opencode-free-stack
```

```bash
export OPENCODE_API_KEY=...   # OpenCode Zen
export GITHUB_TOKEN=...        # GitHub Copilot
export BEATAPI_API_KEY=...     # BeatAPI
export APINEX_API_KEY=...      # APInex
```

## Use

```bash
ofs models            # every known free model, grouped by provider
ofs status            # which providers are configured, how much quota is left
ofs chain             # the exact fallback order that would be used
ofs route "explain quicksort"   # send one prompt through the chain
```

```js
import { routerFromEnv } from "opencode-free-stack"

const router = routerFromEnv()
const res = await router.chat([{ role: "user", content: "hi" }])

if (res.ok) {
  console.log(res.provider, res.model, res.content)
} else {
  console.error(res.attempts)   // why every provider refused
}
```

## How the fallback works

1. Build a chain: the **preferred** model of each provider first, then its other free models.
2. Wait out the provider's **RPM** limit (sliding window, no busy-wait spin).
3. Send the request. On failure, classify it:
   - `rate_limit` → try the next model
   - `quota_exhausted` → burn today's pool and skip the provider
   - `auth` → skip the provider (bad key)
   - `upstream` → try the next model
4. Charge the daily pool with `tokens × weight` so the router knows when a provider is done for the day.

## OpenCode plugin

```jsonc
// opencode.json
{
  "provider": {
    "apinex": { "npm": "@ai-sdk/openai-compatible", "options": { "baseURL": "https://api.apinex.bond/v1" } }
  }
}
```

Then point OpenCode at the models this package knows about — see `examples/opencode.json` in this repo for a complete, copy-pasteable configuration with 30 free models and zero paid ones.

## Donate

This project is MIT and stays free. If it saved you money, you can send USDC on **Base**:

```
0x8aC6a229f254980CCd3Dd35CF5E1B7c08880B40E
```

Every donation goes straight into the project's own running costs (test API keys, CI, the hosted registry).

## Bounties

Issues labelled `💰 Reward` can be funded by anyone with `/reward <amount>` (Opire) or via [Algora](https://algora.io). The bounty goes to the person whose PR gets merged — the repo owner never keeps it. That is deliberate: it buys contributors, reviews and stars.

## Roadmap

- [x] provider registry with limits, weights and preferred models
- [x] RPM limiter + daily pool accounting
- [x] fallback router with error classification
- [x] CLI (`ofs`) and tests
- [ ] OpenCode plugin that rewrites `model` on 402/429 automatically
- [ ] hosted model registry (`GET /models.json`) refreshed hourly
- [ ] adapters for more free providers

## Contributing

```bash
git clone https://github.com/rustemmustafingovua-byte/opencode-free-stack
npm test
```

Adding a provider means one entry in `src/providers.js` — no other file changes.

## License

MIT © rustemmustafingovua-byte
