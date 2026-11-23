/**
 * Provider registry — describes every free-tier endpoint we know about,
 * how to authenticate it, and what its limits are.
 *
 * Every entry is intentionally declarative so the router and sync-models script
 * can reason about fallbacks and catalogue refreshes without hard-coding
 * provider logic.
 */

/**
 * @typedef {"zen"|"copilot"|"beatapi"|"apinex"|"venice"|"groq"|"cerebras"|"google"|"gitlab"|"cloudflare"|"mistral"|"sambanova"|"nebius"|"together"} ProviderId
 */

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
    sync: { modelsDevId: "opencode", freeOnlyFromModelsDev: true },
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
    sync: { modelsEndpoint: "https://api.beatapi.io/v1/models", suffix: "-free" },
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
    sync: { publicCatalog: "https://apinex.bond/api/public/models", prefix: "free/" },
    notes: "Daily pool of 10M tokens, spent as tokens x model weight (2..4). Resets 00:00 UTC.",
  },
  groq: {
    id: "groq",
    name: "Groq",
    baseURL: "https://api.groq.com/openai/v1",
    env: ["GROQ_API_KEY"],
    freeModels: [
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "qwen/qwen3-32b",
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
    ],
    rpm: 30,
    dailyTokens: 500_000,
    preferred: ["llama-3.3-70b-versatile", "openai/gpt-oss-120b", "llama-3.1-8b-instant"],
    sync: { modelsDevId: "groq", modelsEndpoint: "https://api.groq.com/openai/v1/models" },
    notes: "Free developer tier: ~30 RPM and 100k-500k tokens/day depending on model.",
  },
  cerebras: {
    id: "cerebras",
    name: "Cerebras",
    baseURL: "https://api.cerebras.ai/v1",
    env: ["CEREBRAS_API_KEY"],
    freeModels: ["gpt-oss-120b", "qwen-3-32b", "llama-3.3-70b", "llama3.1-8b"],
    rpm: 30,
    dailyTokens: 1_000_000,
    preferred: ["gpt-oss-120b", "qwen-3-32b", "llama-3.3-70b"],
    sync: { modelsDevId: "cerebras", modelsEndpoint: "https://api.cerebras.ai/v1/models" },
    notes: "Free tier: 30 RPM and 1M tokens/day across supported open-weight models.",
  },
  google: {
    id: "google",
    name: "Google AI Studio",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    env: ["GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"],
    freeModels: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemma-3-27b-it"],
    rpm: 15,
    dailyTokens: null,
    preferred: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemma-3-27b-it"],
    sync: {
      modelsDevId: "google",
      modelsEndpoint: "https://generativelanguage.googleapis.com/v1beta/openai/models",
    },
    notes: "OpenAI-compatible endpoint for Gemini and Gemma free-tier quotas (10-15 RPM).",
  },
  gitlab: {
    id: "gitlab",
    name: "GitLab Duo",
    baseURL: "https://cloud.gitlab.com/ai/v1/proxy/openai/v1",
    env: ["GITLAB_TOKEN", "GITLAB_API_TOKEN"],
    freeModels: ["duo-chat-gpt-5-2", "duo-chat-gpt-5-4-nano", "duo-chat-gpt-5-codex"],
    rpm: 20,
    dailyTokens: null,
    preferred: ["duo-chat-gpt-5-codex", "duo-chat-gpt-5-2", "duo-chat-gpt-5-4-nano"],
    sync: { modelsDevId: "gitlab", freeOnlyFromModelsDev: true },
    notes: "GitLab Duo proxy models exposed with $0 API cost in models.dev for eligible accounts.",
  },
  cloudflare: {
    id: "cloudflare",
    name: "Cloudflare Workers AI",
    baseURL: "https://api.cloudflare.com/client/v4/accounts/{accountId}/ai/v1",
    env: ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_API_KEY", "CF_API_TOKEN"],
    accountEnv: ["CLOUDFLARE_ACCOUNT_ID", "CF_ACCOUNT_ID"],
    freeModels: [
      "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      "@cf/qwen/qwq-32b",
      "@cf/qwen/qwen3-30b-a3b-fp8",
      "@cf/meta/llama-3.1-8b-instruct",
    ],
    rpm: 30,
    dailyTokens: null,
    preferred: ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/qwen/qwq-32b"],
    sync: { modelsDevId: "cloudflare-workers-ai" },
    notes: "Free tier includes 10,000 Neurons/day; requires CLOUDFLARE_ACCOUNT_ID alongside token.",
  },
  mistral: {
    id: "mistral",
    name: "Mistral La Plateforme",
    baseURL: "https://api.mistral.ai/v1",
    env: ["MISTRAL_API_KEY"],
    freeModels: ["mistral-small-latest", "codestral-latest", "open-mistral-nemo", "ministral-8b-latest"],
    rpm: 60,
    dailyTokens: null,
    preferred: ["codestral-latest", "mistral-small-latest", "open-mistral-nemo"],
    sync: { modelsDevId: "mistral", modelsEndpoint: "https://api.mistral.ai/v1/models" },
    notes: "Experiment plan: free tier with ~1 req/s (up to 60 RPM) and generous monthly token cap.",
  },
  sambanova: {
    id: "sambanova",
    name: "SambaNova",
    baseURL: "https://api.sambanova.ai/v1",
    env: ["SAMBANOVA_API_KEY"],
    freeModels: ["Meta-Llama-3.3-70B-Instruct", "DeepSeek-R1-Distill-Llama-70B", "gpt-oss-120b"],
    rpm: 20,
    dailyTokens: null,
    preferred: ["Meta-Llama-3.3-70B-Instruct", "gpt-oss-120b"],
    sync: { modelsDevId: "sambanova", modelsEndpoint: "https://api.sambanova.ai/v1/models" },
    notes: "Free developer tier with fast RDU inference; rate-limited per minute and per day.",
  },
  nebius: {
    id: "nebius",
    name: "Nebius AI Studio",
    baseURL: "https://api.tokenfactory.nebius.com/v1",
    env: ["NEBIUS_API_KEY"],
    freeModels: ["Qwen/Qwen3-30B-A3B-Instruct-2507", "meta-llama/Meta-Llama-3.1-8B-Instruct"],
    rpm: 30,
    dailyTokens: null,
    preferred: ["Qwen/Qwen3-30B-A3B-Instruct-2507", "meta-llama/Meta-Llama-3.1-8B-Instruct"],
    sync: { modelsDevId: "nebius", modelsEndpoint: "https://api.tokenfactory.nebius.com/v1/models" },
    notes: "OpenAI-compatible endpoint; trial credits and free-tier test models.",
  },
  together: {
    id: "together",
    name: "Together AI",
    baseURL: "https://api.together.xyz/v1",
    env: ["TOGETHER_API_KEY"],
    freeModels: [
      "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
      "deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free",
    ],
    rpm: 60,
    dailyTokens: null,
    preferred: [
      "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
      "deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free",
    ],
    sync: {
      modelsDevId: "togetherai",
      modelsEndpoint: "https://api.together.xyz/v1/models",
      suffix: "-free",
    },
    notes: "Dedicated -Free model endpoints with 60 RPM limit; requires TOGETHER_API_KEY.",
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
}

export function listProviders() {
  return Object.values(PROVIDERS)
}

/**
 * Resolve the effective base URL for a provider, interpolating placeholders
 * like `{accountId}` from `accountEnv` when configured.
 *
 * @param {object} provider
 * @param {Record<string, string | undefined>} [env]
 * @returns {string}
 */
export function resolveBaseURL(provider, env = process.env) {
  let url = provider.baseURL
  if (url.includes("{accountId}")) {
    const accountId = (provider.accountEnv || []).map((k) => env[k]).find(Boolean)
    if (accountId) url = url.replace("{accountId}", accountId)
  }
  return url
}

/**
 * Flat list of every free model id, prefixed with the provider id.
 * @returns {Array<{provider: ProviderId, model: string, weight: number}>}
 */
export function listFreeModels() {
  const out = []
  for (const p of listProviders()) {
    for (const m of p.freeModels || []) {
      out.push({ provider: p.id, model: m, weight: p.weight ?? 1 })
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
