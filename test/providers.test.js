import { test } from "node:test"
import assert from "node:assert/strict"
import { PROVIDERS, fallbackChain, resolveBaseURL, listFreeModels } from "../src/providers.js"
import { FreeRouter, routerFromEnv } from "../src/router.js"
import { buildRegistry } from "../scripts/sync-models.mjs"

const NEW_PROVIDERS = [
  "groq",
  "cerebras",
  "google",
  "gitlab",
  "cloudflare",
  "mistral",
  "sambanova",
  "nebius",
  "together",
]

test("all newly added free-tier providers are declared in PROVIDERS", () => {
  for (const id of NEW_PROVIDERS) {
    const p = PROVIDERS[id]
    assert.ok(p, `provider ${id} must exist in PROVIDERS`)
    assert.equal(p.id, id)
    assert.ok(typeof p.name === "string" && p.name.length > 0)
    assert.ok(typeof p.baseURL === "string" && p.baseURL.startsWith("https://"))
    assert.ok(Array.isArray(p.env) && p.env.length > 0)
    assert.ok(Array.isArray(p.freeModels) && p.freeModels.length > 0, `${id} must list freeModels`)
    assert.ok(Array.isArray(p.preferred) && p.preferred.length > 0, `${id} must list preferred`)
    for (const m of p.preferred) {
      assert.ok(p.freeModels.includes(m), `${id} preferred model ${m} must be in freeModels`)
    }
  }
})

test("routerFromEnv detects keys for the new providers", () => {
  const r = routerFromEnv({
    GROQ_API_KEY: "gsk_test",
    CEREBRAS_API_KEY: "csk_test",
    GEMINI_API_KEY: "AIza_test",
    GITLAB_TOKEN: "glpat_test",
    CLOUDFLARE_API_TOKEN: "cf_tok",
    CLOUDFLARE_ACCOUNT_ID: "acc_123",
    MISTRAL_API_KEY: "mis_test",
    SAMBANOVA_API_KEY: "sn_test",
    NEBIUS_API_KEY: "neb_test",
    TOGETHER_API_KEY: "tog_test",
  })
  const ready = r.ready()
  for (const id of NEW_PROVIDERS) {
    assert.ok(ready.includes(id), `routerFromEnv should mark ${id} ready`)
  }
})

test("resolveBaseURL interpolates Cloudflare account id from env", () => {
  const url = resolveBaseURL(PROVIDERS.cloudflare, { CLOUDFLARE_ACCOUNT_ID: "acct-42" })
  assert.equal(url, "https://api.cloudflare.com/client/v4/accounts/acct-42/ai/v1")
  assert.equal(resolveBaseURL(PROVIDERS.groq, {}), "https://api.groq.com/openai/v1")
})

test("router falls back from a failing primary provider to newly added providers", async () => {
  const hitUrls = []
  const original = globalThis.fetch
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body)
    hitUrls.push({ url, model: body.model, auth: init.headers.Authorization })
    if (url.startsWith(PROVIDERS.apinex.baseURL)) {
      return new Response(JSON.stringify({ error: { message: "Free 10M tokens used." } }), { status: 402 })
    }
    if (url.startsWith(PROVIDERS.groq.baseURL)) {
      return new Response(JSON.stringify({ error: { message: "429 Rate limit exceeded" } }), { status: 429 })
    }
    if (url.startsWith(PROVIDERS.cerebras.baseURL)) {
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "answered by cerebras" } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
        { status: 200 },
      )
    }
    return new Response("unexpected", { status: 500 })
  }
  try {
    const router = new FreeRouter({
      keys: { apinex: "k-ap", groq: "k-gr", cerebras: "k-ce" },
      rpm: { apinex: null, groq: null, cerebras: null },
    })
    const res = await router.chat([{ role: "user", content: "hello" }], {
      providers: ["apinex", "groq", "cerebras"],
    })
    assert.equal(res.ok, true)
    assert.equal(res.provider, "cerebras")
    assert.equal(res.model, PROVIDERS.cerebras.preferred[0])
    assert.equal(res.content, "answered by cerebras")
    assert.ok(hitUrls.some((h) => h.url.startsWith(PROVIDERS.groq.baseURL)))
    assert.ok(hitUrls.some((h) => h.url.startsWith(PROVIDERS.cerebras.baseURL)))
  } finally {
    globalThis.fetch = original
  }
})

test("router skips Cloudflare when account id is missing and falls back to Mistral", async () => {
  const original = globalThis.fetch
  globalThis.fetch = async (url) => {
    assert.ok(url.startsWith(PROVIDERS.mistral.baseURL), `expected mistral URL, got ${url}`)
    return new Response(
      JSON.stringify({ choices: [{ message: { content: "mistral ok" } }], usage: { total_tokens: 4 } }),
      { status: 200 },
    )
  }
  try {
    const router = new FreeRouter({
      keys: { cloudflare: "cf-key", mistral: "mis-key" },
      env: {},
      rpm: { cloudflare: null, mistral: null },
    })
    const res = await router.chat([{ role: "user", content: "hi" }], {
      providers: ["cloudflare", "mistral"],
    })
    assert.equal(res.ok, true)
    assert.equal(res.provider, "mistral")
    assert.equal(res.content, "mistral ok")
    assert.ok(res.attempts.some((a) => a.provider === "cloudflare" && a.kind === "config"))
  } finally {
    globalThis.fetch = original
  }
})

test("sync-models buildRegistry picks up new providers declaratively from PROVIDERS", async () => {
  const fakeModelsDev = {
    opencode: {
      models: {
        "glm-5.3-flash-free": { name: "GLM 5.3 Flash Free", cost: { input: 0, output: 0 }, limit: { context: 128000 } },
      },
    },
    groq: {
      models: {
        "llama-3.3-70b-versatile": { name: "Llama 3.3 70B Versatile", cost: { input: 0.59, output: 0.79 }, limit: { context: 131072 } },
      },
    },
    gitlab: {
      models: {
        "duo-chat-gpt-5-codex": { name: "Duo Chat GPT-5 Codex", cost: { input: 0, output: 0 }, limit: { context: 200000 } },
      },
    },
  }
  const customProviders = {
    ...PROVIDERS,
    acme: {
      id: "acme",
      name: "Acme Free AI",
      baseURL: "https://api.acme.test/v1",
      env: ["ACME_API_KEY"],
      freeModels: ["acme-mini-free"],
      preferred: ["acme-mini-free"],
      rpm: 20,
      dailyTokens: null,
      sync: { modelsEndpoint: "https://api.acme.test/v1/models", suffix: "-free" },
    },
  }
  const getJSON = async (url) => {
    if (url === "https://models.dev/api.json") return fakeModelsDev
    if (url === "https://api.acme.test/v1/models") {
      return { data: [{ id: "acme-pro-paid" }, { id: "acme-mini-free" }, { id: "acme-coder-free" }] }
    }
    return null
  }
  const reg = await buildRegistry({
    providers: customProviders,
    getJSON,
    env: { ACME_API_KEY: "test-key" },
    generatedAt: "2026-11-23T00:00:00.000Z",
  })

  for (const id of NEW_PROVIDERS) {
    assert.ok(reg.providers[id], `sync-models must include ${id}`)
    assert.ok(reg.providers[id].free.length > 0, `sync-models must include free models for ${id}`)
  }
  const groqLlama = reg.providers.groq.free.find((m) => m.id === "llama-3.3-70b-versatile")
  assert.equal(groqLlama.context, 131072, "metadata from models.dev should enrich declared models")

  assert.deepEqual(
    reg.providers.acme.free.map((m) => m.id),
    ["acme-mini-free", "acme-coder-free"],
    "a newly added provider entry is picked up by sync-models automatically",
  )

  const chain = fallbackChain(["groq", "sambanova"])
  assert.equal(chain[0].provider, "groq")
  assert.ok(listFreeModels().some((m) => m.provider === "sambanova"))
})
