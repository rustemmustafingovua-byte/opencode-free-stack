/**
 * opencode-free-stack — OpenCode plugin.
 *
 * What it does:
 *   1. remembers the last user message of every session
 *   2. watches for `session.error` events
 *   3. when the failure is a free-tier failure (`402` quota, `429` rate limit),
 *      it picks the next free model in the chain and continues the same turn
 *      with it — no manual model switch, no lost work
 *
 * Install:
 *   npm i -D opencode-free-stack
 *   // opencode.json
 *   { "plugin": ["opencode-free-stack/plugin"] }
 */

import { FreeRouter, PROVIDERS, fallbackChain } from "../src/index.js"
import { isFreeTierFailure, reasonOf, nextModel } from "../src/fallback.js"

export { isFreeTierFailure, reasonOf, nextModel }

export const OpencodeFreeStack = async ({ client }) => {
  const router = new FreeRouter({ keys: keysFromEnv() })
  /** @type {Map<string, {text: string, agent?: string}>} */
  const lastUserMessage = new Map()
  /** @type {Map<string, Set<string>>} */
  const tried = new Map()
  /** @type {Map<string, {provider: string, model: string}>} */
  const current = new Map()

  return {
    /** Remember the prompt so a fallback can replay it. */
    "chat.message": async (input, output) => {
      const text = (output.parts || [])
        .filter((p) => p.type === "text")
        .map((p) => p.text)
        .join("\n")
        .trim()
      if (text) lastUserMessage.set(input.sessionID, { text, agent: input.agent })
      if (input.model) current.set(input.sessionID, input.model)
    },

    /** React to a failed turn: try the next free model. */
    event: async ({ event }) => {
      if (!event || event.type !== "session.error") return
      const sessionID = event.properties?.sessionID
      if (!sessionID) return
      const err = event.properties?.error
      const text = String(err?.data?.message ?? err?.message ?? err?.name ?? "")
      if (!isFreeTierFailure(text)) return

      const model = current.get(sessionID)
      if (!model) return

      const set = tried.get(sessionID) ?? new Set()
      set.add(`${model.providerID}/${model.modelID}`)
      tried.set(sessionID, set)

      const chain = fallbackChain(router.ready())
      const next = nextModel(chain, model.providerID, model.modelID, set)
      if (!next) {
        console.error(`[opencode-free-stack] no free model left (${reasonOf(text)})`)
        return
      }

      const prompt = lastUserMessage.get(sessionID)
      if (!prompt) return

      console.error(
        `[opencode-free-stack] ${model.providerID}/${model.modelID} → ${next.key} (${reasonOf(text)})`,
      )
      try {
        await client.session.prompt({
          path: { id: sessionID },
          body: {
            model: { providerID: next.provider, modelID: next.model },
            agent: prompt.agent,
            parts: [{ type: "text", text: prompt.text }],
          },
        })
      } catch (e) {
        console.error(`[opencode-free-stack] fallback failed: ${e?.message ?? e}`)
      }
    },
  }
}

function keysFromEnv(env = process.env) {
  const keys = {}
  for (const p of Object.values(PROVIDERS)) {
    for (const name of p.env) {
      if (env[name]) {
        keys[p.id] = env[name]
        break
      }
    }
  }
  return keys
}

export default OpencodeFreeStack
