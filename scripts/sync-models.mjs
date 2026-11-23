#!/usr/bin/env node
/**
 * Refreshes models.json — the public registry of free models the router knows
 * about. Runs on a schedule (see .github/workflows/sync-models.yml).
 *
 * Driven declaratively from PROVIDERS in src/providers.js: adding a new
 * provider entry there is enough for `npm run sync-models` to include it.
 */
import { writeFileSync, existsSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { PROVIDERS, resolveBaseURL } from "../src/providers.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const out = join(root, "models.json")

async function defaultGetJSON(url, headers = {}) {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(25000) })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function firstEnv(names = [], env = process.env) {
  for (const name of names) {
    if (env[name]) return env[name]
  }
  return null
}

function normalizeModelList(list) {
  const seen = new Set()
  const outList = []
  for (const item of list) {
    if (!item?.id || seen.has(item.id)) continue
    seen.add(item.id)
    outList.push(item)
  }
  return outList
}

function matchModelsDevEntries(modelsDev, provider) {
  const devId = provider.sync?.modelsDevId
  if (!devId || !modelsDev?.[devId]?.models) return { freeOnly: [], byId: new Map() }
  const catalog = modelsDev[devId].models
  const byId = new Map()
  const freeOnly = []
  for (const [id, v] of Object.entries(catalog)) {
    if (v.status === "deprecated" || v.status === "alpha") continue
    const entry = { id, name: v.name || id, context: v.limit?.context ?? null }
    byId.set(id, entry)
    const c = v.cost || {}
    if (Number(c.input ?? 1) === 0 && Number(c.output ?? 1) === 0) {
      freeOnly.push(entry)
    }
  }
  return { freeOnly, byId }
}

/**
 * Build the models.json registry declaratively from a provider map.
 *
 * @param {object} [opts]
 * @param {Record<string, object>} [opts.providers]
 * @param {(url: string, headers?: Record<string, string>) => Promise<any>} [opts.getJSON]
 * @param {Record<string, string | undefined>} [opts.env]
 * @param {string} [opts.generatedAt]
 */
export async function buildRegistry({
  providers = PROVIDERS,
  getJSON = defaultGetJSON,
  env = process.env,
  generatedAt = new Date().toISOString(),
} = {}) {
  const registry = { generatedAt, providers: {} }
  const needsModelsDev = Object.values(providers).some((p) => p.sync?.modelsDevId)
  const modelsDev = needsModelsDev ? await getJSON("https://models.dev/api.json") : null

  for (const p of Object.values(providers)) {
    const declared = p.freeModels || []
    const sync = p.sync || {}
    if (!declared.length && !sync.modelsDevId && !sync.publicCatalog && !sync.modelsEndpoint) {
      continue
    }

    let free = []
    const { freeOnly, byId } = matchModelsDevEntries(modelsDev, p)

    // 1. Public JSON catalogue (e.g. APInex /api/public/models)
    if (sync.publicCatalog) {
      const cat = await getJSON(sync.publicCatalog)
      if (cat?.models) {
        free = cat.models
          .filter((m) => (!sync.prefix || m.id.startsWith(sync.prefix)) && (!sync.suffix || m.id.toLowerCase().endsWith(sync.suffix)))
          .map((m) => ({
            id: m.id,
            name: m.name || m.id,
            ...(m.weight != null ? { weight: m.weight } : {}),
            ...(m.contextWindow != null ? { context: m.contextWindow } : {}),
          }))
      }
    }

    // 2. OpenAI-compatible /models endpoint when an API key is available
    const apiKey = firstEnv(p.env, env)
    if (!free.length && sync.modelsEndpoint && apiKey) {
      const endpoint = sync.modelsEndpoint.includes("{accountId}")
        ? resolveBaseURL({ ...p, baseURL: sync.modelsEndpoint }, env)
        : sync.modelsEndpoint
      if (!endpoint.includes("{accountId}")) {
        const res = await getJSON(endpoint, { Authorization: `Bearer ${apiKey}`, ...(p.headers || {}) })
        const rows = Array.isArray(res) ? res : res?.data
        if (Array.isArray(rows) && rows.length) {
          const filtered = rows.filter((m) => {
            const id = m?.id || ""
            if (!id) return false
            if (sync.prefix && !id.startsWith(sync.prefix)) return false
            if (sync.suffix && !id.toLowerCase().endsWith(sync.suffix)) return false
            return true
          })
          if (filtered.length) {
            free = filtered.map((m) => {
              const meta = byId.get(m.id)
              return {
                id: m.id,
                name: meta?.name || m.name || m.id,
                ...(meta?.context != null ? { context: meta.context } : {}),
              }
            })
          }
        }
      }
    }

    // 3. models.dev $0 entries for providers whose free models are tagged cost=0
    if (!free.length && sync.freeOnlyFromModelsDev && freeOnly.length) {
      free = freeOnly
    }

    // 4. Declarative provider freeModels enriched with models.dev metadata (plus any $0 models.dev hits)
    if (!free.length && (declared.length || freeOnly.length)) {
      const enriched = declared.map((id) => {
        const meta = byId.get(id)
        return {
          id,
          name: meta?.name || id,
          ...(meta?.context != null ? { context: meta.context } : {}),
        }
      })
      free = normalizeModelList([...enriched, ...freeOnly])
    } else {
      free = normalizeModelList(free)
    }

    if (!free.length) continue

    const entry = {
      name: p.name,
      baseURL: resolveBaseURL(p, env),
      ...(p.dailyTokens ? { freeDailyTokens: p.dailyTokens } : {}),
      ...(p.rpm != null ? { rpm: p.rpm } : {}),
      free,
    }
    registry.providers[p.id] = entry
  }

  return registry
}

const isDirectRun =
  process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])

if (isDirectRun) {
  const registry = await buildRegistry()
  writeFileSync(out, JSON.stringify(registry, null, 2) + "\n")
  const total = Object.values(registry.providers).reduce((n, p) => n + (p.free?.length ?? 0), 0)
  console.log(`models.json written: ${Object.keys(registry.providers).length} providers, ${total} free models`)
  if (!existsSync(out)) process.exit(1)
}
