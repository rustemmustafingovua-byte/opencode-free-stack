/**
 * Provider registry — describes every free-tier endpoint we know about,
 * how to authenticate it, and what its limits are.
 *
 * Every entry is intentionally declarative so the router can reason about
 * fallbacks without hard-coding provider logic.
 */

/** @typedef {"zen"|"copilot"|"beatapi"|"apinex"|"venice"|"jina"} ProviderId */

export const PROVIDERS = {
  zen: {
    id: "zen",
    name: "OpenCode Zen",
    baseURL: "https://opencode.ai/inference/openai/v1",
    env: ["OPENCODE_API_KEY"],
    authFile: ["opencode", "opencode-go"],
    // free models: ids ending in -free plus the always-free picks
    freeModels: [
      "beam-free",
      "deepseek-v4.1-flash-free",
      "glm-5.3-flash-free",
      "longcat-2.5-preview-free",
      "mimo-v2.6-flash-free",
      "minimax-m3.1-flash-free",
      "nemotron-3-ultra-free",
      "nemotron-3.5-lightning-free",
      "nemotron-3.5-super-vl-free",
    ],
    rpm: null,
    dailyTokens: null,
    // order = preference: strongest first
    preferred: ["minimax-m3.1-flash-free", "glm-5.3-flash-free", "deepseek-v4.1-flash-free"],
    notes: "No daily cap we could observe; served only from inside OpenCode.",
  },
  copilot: {
    id: "copilot",
    name: "GitHub Copilot",
    baseURL: "https://api.githubcopilot.com",
    env: ["GITHUB_TOKEN"],
    headers: { "Editor-Version": "vscode/1.99.0", "Copilot-Integration-Id": "vscode-chat" },
    freeModels: ["gpt-4.1", "gpt-4.1-2025-04-14", "gpt-5.4-mini-free-auto", "kimi-k3-copilot", "kimi-k3-base"],
    rpm: 30,
    dailyTokens: null,
    preferred: ["gpt-4.1", "gpt-5.4-mini-free-auto"],
    notes: "Free plan: ~50 premium requests/month. Claude models are blocked on the free SKU.",
  },
  beatapi: {
    id: "beatapi",
    name: "BeatAPI",
    baseURL: "https://api.beatapi.io/v1",
    env: ["BEATAPI_API_KEY"],
    freeModels: [
      "deepseek-v4-flash-0731-free",
      "deepseek-v4.1-flash-free",
      "gemini-3.8-flash-free",
      "glm-5.3-flash-free",
      "glm-5.3-free",
    ],
    rpm: 1,
    rpmAfterTopup: 10,
    dailyTokens: null,
    preferred: ["glm-5.3-free", "deepseek-v4.1-flash-free", "gemini-3.8-flash-free"],
    notes: "Free models: 1 request/min before any top-up, 10/min after.",
  },
  apinex: {
    id: "apinex",
    name: "APInex",
    baseURL: "https://api.apinex.bond/v1",
    env: ["APINEX_API_KEY"],
    freeModels: [
      "free/qwen-3.8-max",
      "free/deepseek-v4-pro-0813",
      "free/gemini-3.8-flash",
      "free/glm-5.3-flashx",
      "free/glm-5.3-flash",
      "free/deepseek-v4.1-flash",
      "free/deepseek-v4-flash-0731",
      "free/mimo-v2.6-pro",
      "free/glm-5.3",
    ],
    // documented in the provider catalogue: 10M tokens/day, weight 1..4 per model
    dailyTokens: 10_000_000,
    weight: 3,
    rpm: 5,
    preferred: ["free/qwen-3.8-max", "free/deepseek-v4-pro-0813", "free/gemini-3.8-flash"],
    notes: "Daily pool of 10M tokens, spent as tokens x model weight (2..4). Resets 00:00 UTC.",
  },
  venice: {
    id: "venice",
    name: "Venice AI",
    baseURL: "https://api.venice.ai/api/v1",
    env: ["VENICE_API_KEY"],
    // paid in USDC (x402) — kept here so the router can fall back when it is funded
    freeModels: [],
    paidModels: ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"],
    rpm: null,
    dailyTokens: null,
    preferred: ["claude-haiku-5-5"],
    notes: "x402 USDC payments, no account needed. Claude from $0.10 / 1M input tokens.",
  },
}

/** Models that are free but need a subscription to unlock (APInex). */
export const SUBSCRIPTION_ONLY = {
  apinex: [
    "free/claude-opus-4.6",
    "free/claude-sonnet-4.6",
    "free/gemini-3.1-pro",
    "free/kimi-k3",
    "free/minimax-m3",
    "free/muse-spark-1.3",
    "free/hy4",
    "free/mimo-v2.6-flash",
  ],
};

export function listProviders() {
  return Object.values(PROVIDERS)
}

/**
 * Flat list of every free model id, prefixed with the provider id.
 * @returns {Array<{provider: ProviderId, model: string, weight: number}>}
 */
export function listFreeModels() {
  const out = []
  for (const p of listProviders()) {
    for (const m of p.freeModels || []) {
      out.push({ provider: p.id, model: m, weight: p.id === "apinex" ? p.weight : 1 })
    }
  }
  return out
}

/**
 * Build a fallback chain: preferred models first, then the rest.
 * @param {ProviderId[]} providerIds
 * @returns {Array<{provider: ProviderId, model: string}>}
 */
export function fallbackChain(providerIds) {
  const chain = []
  for (const id of providerIds) {
    const p = PROVIDERS[id]
    if (!p) continue
    for (const m of p.preferred || []) chain.push({ provider: id, model: m })
    for (const m of p.freeModels || []) {
      if (!(p.preferred || []).includes(m)) chain.push({ provider: id, model: m })
    }
  }
  return chain
}
