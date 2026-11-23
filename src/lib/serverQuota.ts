import { models, SERVER_KEY_ENV_VARS, type ModelInfo } from './models'

/**
 * Usage limits for models that run on the server's own API keys (`isFree` models used without the
 * user's own key). Counted per UTC day in Convex (`serverUsage` table), per user or per guest and
 * globally per model. A provider 429/quota error pauses the model for everyone for a while.
 */
export const QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000
export const PROVIDER_COOLDOWN_MS = 10 * 60 * 1000

export interface ServerModelLimits {
  /** Requests per signed-in user per day. */
  user: number
  /** Requests per guest (by IP) per day. */
  guest: number
  /** Requests across everyone per day. */
  global: number
}

const DEFAULT_LIMITS: ServerModelLimits = { user: 200, guest: 40, global: 10_000 }

const MODEL_LIMITS: Record<string, ServerModelLimits> = {
  'gpt-6-luna': { user: 100, guest: 20, global: 3_000 },
}

export const serverModelLimits = (modelId: string): ServerModelLimits => MODEL_LIMITS[modelId] ?? DEFAULT_LIMITS

/** Models that can run on a server key (and so are subject to the server limits). */
export const serverKeyModels: ModelInfo[] = models.filter((model) => model.isFree && SERVER_KEY_ENV_VARS[model.provider])

export const isServerKeyModel = (modelId: string) => serverKeyModels.some((model) => model.id === modelId)

/** Env var holding the server key a model runs on, if it has one. */
export const serverKeyEnvVar = (model: ModelInfo) => (model.isFree ? SERVER_KEY_ENV_VARS[model.provider] : undefined)

/** Start of the fixed window containing `now`. */
export const quotaWindowStart = (now: number) => Math.floor(now / QUOTA_WINDOW_MS) * QUOTA_WINDOW_MS

export type ServerModelStatus = { available: true } | { available: false; reason: 'no-key' | 'cooldown' | 'limit' }

/** Availability of each server-key model, keyed by model id. Models not listed aren't server-key models. */
export type ServerModelAvailability = Record<string, ServerModelStatus>

// ---------------------------------------------------------------------------
// Request signing between the Next.js server (/api/chat) and Convex.
//
// Guests have no Convex identity, so /api/chat identifies them by a keyed hash of their IP and signs
// each quota call with a secret both sides hold. Clients can't forge calls to burn others' quota.
// ---------------------------------------------------------------------------

export const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000

/**
 * Shared secret for signing guest quota calls. Must be set to the same value on Vercel and Convex;
 * without it guests can't use the free models (requests fail closed).
 */
export const quotaSecret = () => process.env.CHAT_QUOTA_SECRET || ''

const hmacHex = async (secret: string, message: string) => {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Stable, non-reversible guest id for an IP address. */
export const guestSubject = async (secret: string, ip: string) => `g_${(await hmacHex(secret, `guest-ip:${ip}`)).slice(0, 32)}`

const signedMessage = (parts: { subject: string; modelId: string; action: string; ts: number }) =>
  `${parts.action}|${parts.subject}|${parts.modelId}|${parts.ts}`

export const signQuotaRequest = async (
  secret: string,
  parts: { subject: string; modelId: string; action: 'consume' | 'cooldown' },
  now = Date.now(),
) => ({ ...parts, ts: now, sig: await hmacHex(secret, signedMessage({ ...parts, ts: now })) })

/** Constant-time check of a signed quota request. */
export const verifyQuotaRequest = async (
  secret: string,
  request: { subject: string; modelId: string; action: 'consume' | 'cooldown'; ts: number; sig: string },
  now = Date.now(),
) => {
  if (!secret || Math.abs(now - request.ts) > SIGNATURE_MAX_AGE_MS) return false
  const expected = await hmacHex(secret, signedMessage(request))
  if (expected.length !== request.sig.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ request.sig.charCodeAt(i)
  return diff === 0
}
