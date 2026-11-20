/**
 * Safe handling of AI provider errors.
 *
 * Provider error messages and response bodies are not under our control. They
 * can echo request details, including the API key that was sent. Never log them
 * or show them to users: only use the numeric HTTP status and an allowlisted
 * error class name.
 */

/** HTTP status of a provider error. */
export const providerErrorStatus = (error: unknown): number | undefined => {
  const err = error as
    | { statusCode?: unknown; status?: unknown; lastError?: { statusCode?: unknown } }
    | null
    | undefined
  // AI SDK errors use statusCode (RetryError wraps the last one); @google/genai uses status
  const status = err?.statusCode ?? err?.lastError?.statusCode ?? err?.status
  return typeof status === 'number' ? status : undefined
}

/** Error class name if it is a known AI SDK / runtime error name, otherwise "Error". */
const safeErrorName = (error: unknown): string => {
  const name = (error as { name?: unknown } | null | undefined)?.name
  return typeof name === 'string' && /^(AI_[A-Za-z]+|AbortError|TimeoutError|TypeError)$/.test(name) ? name : 'Error'
}

/** Controlled fields only: safe to pass to console.* */
export const describeProviderError = (context: { provider: string; model: string }, error: unknown) => ({
  provider: context.provider,
  model: context.model,
  status: providerErrorStatus(error),
  error: safeErrorName(error),
})

/** Fixed, user-facing message for a provider error. */
export const userFacingProviderError = (error: unknown, providerName: string, modelName: string): string => {
  const status = providerErrorStatus(error)
  if (status === 401 || status === 403) {
    return `${providerName} rejected the API key. Check your key in Settings → Models & Keys.`
  }
  if (status === 429) {
    return `${providerName} rate limit or quota reached. Please try again later.`
  }
  if (status === 500 || status === 502 || status === 503 || status === 529) {
    return `${modelName} is temporarily overloaded. Please try again in a moment or pick another model.`
  }
  return 'Error occurred while generating response.'
}
