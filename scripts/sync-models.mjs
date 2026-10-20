#!/usr/bin/env node
/**
 * Refreshes models.json — the public registry of free models the router knows
 * about. Runs on a schedule (see .github/workflows/sync-models.yml).
 *
 * Sources (all free, no key required):
 *   - models.dev catalogue for OpenCode Zen
 *   - BeatAPI /v1/models      (needs BEATAPI_API_KEY)
 *   - APInex /api/public/models
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const out = join(root, "models.json")

async function getJSON(url, headers = {}) {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(25000) })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

const registry = { generatedAt: new Date().toISOString(), providers: {} }

// --- OpenCode Zen: free = cost 0 and not deprecated/alpha
const modelsDev = await getJSON("https://models.dev/api.json")
if (modelsDev?.opencode?.models) {
  const free = Object.entries(modelsDev.opencode.models)
    .filter(([, v]) => {
      const c = v.cost || {}
      if (v.status === "deprecated" || v.status === "alpha") return false
      return Number(c.input ?? 1) === 0 && Number(c.output ?? 1) === 0
    })
    .map(([id, v]) => ({ id, name: v.name, context: v.limit?.context ?? null }))
  registry.providers.zen = { name: "OpenCode Zen", baseURL: "https://opencode.ai/inference/openai/v1", free }
}

// --- APInex: free/* catalogue with pool weight
const apinex = await getJSON("https://apinex.bond/api/public/models")
if (apinex?.models) {
  registry.providers.apinex = {
    name: "APInex",
    baseURL: "https://api.apinex.bond/v1",
    freeDailyTokens: 10_000_000,
    free: apinex.models
      .filter((m) => m.id.startsWith("free/"))
      .map((m) => ({ id: m.id, name: m.name, weight: m.weight ?? 1, context: m.contextWindow })),
  }
}

// --- BeatAPI: models with $0 pricing
const beatKey = process.env.BEATAPI_API_KEY
if (beatKey) {
  const beat = await getJSON("https://api.beatapi.io/v1/models", { Authorization: `Bearer ${beatKey}` })
  if (beat?.data) {
    registry.providers.beatapi = {
      name: "BeatAPI",
      baseURL: "https://api.beatapi.io/v1",
      free: beat.data.filter((m) => m.id.endsWith("-free")).map((m) => ({ id: m.id, name: m.id })),
    }
  }
}

writeFileSync(out, JSON.stringify(registry, null, 2) + "\n")
const total = Object.values(registry.providers).reduce((n, p) => n + (p.free?.length ?? 0), 0)
console.log(`models.json written: ${Object.keys(registry.providers).length} providers, ${total} free models`)
if (!existsSync(out)) process.exit(1)
