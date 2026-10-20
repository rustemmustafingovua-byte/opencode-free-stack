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
 * @param {Array<{provider: string, model: string}>} chain
 * @param {string} current provider id of the model that just failed
 * @param {string} currentModel model id that just failed
 * @param {Set<string>} tried models already tried in this turn
 */
export function nextModel(chain, current, currentModel, tried) {
  const idx = chain.findIndex((c) => c.provider === current && c.model === currentModel)
  const start = idx >= 0 ? idx + 1 : 0
  for (let i = start; i < chain.length; i++) {
    const key = `${chain[i].provider}/${chain[i].model}`
    if (tried.has(key)) continue
    return { ...chain[i], key }
  }
  return null
}
