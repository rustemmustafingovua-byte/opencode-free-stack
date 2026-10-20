/**
 * Fallback decision logic — pure, so it can be unit-tested without a browser.
 */

/** Free-tier failures that a different model can solve. */
export function isFreeTierFailure(text) {
  if (!text) return false
  return (
    /free\s+\d+m?\s*tokens\s+used/i.test(text) ||
    /rate limit|\b429\b/i.test(text) ||
    /insufficient balance/i.test(text) ||
    /quota/i.test(text)
  )
}

/** Human-readable reason for the fallback, used in the log line. */
export function reasonOf(text) {
  if (/tokens\s+used/i.test(text)) return "daily pool exhausted"
  if (/rate limit|\b429\b/i.test(text)) return "rate limited"
  if (/insufficient balance/i.test(text)) return "balance too low"
  if (/quota/i.test(text)) return "quota"
  return "provider refused"
}

/**
 * Decide which model to try next.
 *
 * A free pool belongs to the *provider*, not to the model: once one model of a
 * provider reports the daily pool as exhausted, every other model of that
 * provider is dead for today. Skipping them keeps the session short.
 *
 * @param {Array<{provider: string, model: string}>} chain
 * @param {string} current provider id of the model that just failed
 * @param {string} currentModel model id that just failed
 * @param {Set<string>} tried models already tried in this turn
 * @param {Set<string>} [deadProviders] providers known to be out of quota
 */
export function nextModel(chain, current, currentModel, tried, deadProviders = new Set()) {
  const idx = chain.findIndex((c) => c.provider === current && c.model === currentModel)
  const start = idx >= 0 ? idx + 1 : 0
  const usable = (c) => {
    if (deadProviders.has(c.provider)) return false
    return !tried.has(`${c.provider}/${c.model}`)
  }
  // сначала идём дальше по цепочке, потом — возвращаемся к началу:
  // провайдеры в цепочке идут в произвольном порядке, и упавшая модель
  // может оказаться последней.
  for (let i = start; i < chain.length; i++) if (usable(chain[i])) return { ...chain[i], key: `${chain[i].provider}/${chain[i].model}` }
  for (let i = 0; i < start; i++) if (usable(chain[i])) return { ...chain[i], key: `${chain[i].provider}/${chain[i].model}` }
  return null
}

/** How many fallbacks one turn may make before we give up. */
export const MAX_FALLBACKS = 3
