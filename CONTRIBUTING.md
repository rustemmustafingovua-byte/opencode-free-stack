# Contributing

Thanks for helping make free AI actually usable.

## Adding a provider

The whole registry is one file: [`src/providers.js`](src/providers.js). A new entry needs:

```js
myprovider: {
  id: "myprovider",
  name: "My Provider",
  baseURL: "https://api.example.com/v1",
  env: ["MYPROVIDER_API_KEY"],
  freeModels: ["model-a", "model-b"],
  rpm: 5,                    // null = unknown
  dailyTokens: null,         // tokens per day, if the tier has a pool
  weight: 1,                 // pool multiplier, if the tier has one
  preferred: ["model-a"],    // tried first
  notes: "what the catch is",
}
```

That is the whole change. The router, the CLI and the fallback chain pick it up
automatically.

## Tests

```bash
npm test          # node:test, no runner needed
npm run lint      # syntax check
```

New behaviour needs a test. A provider addition needs a test that proves the
router falls back to it.

## Style

- plain JavaScript, ESM, no build step
- no runtime dependencies
- comments explain *why*, not *what*

## Bounties

Issues labelled `💰 Reward` can be funded by anyone with `/reward <amount>`
(Opire) or via Algora. The money is paid to the merged PR — not to the repo
owner. If you are funded, claim with `/claim #<issue>` in your PR.
