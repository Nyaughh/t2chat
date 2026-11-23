// Server-only module: imported by API routes, never by client components.
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../convex/_generated/api'
import { models } from './models'
import {
  guestSubject,
  quotaSecret,
  serverKeyEnvVar,
  serverKeyModels,
  signQuotaRequest,
  type ServerModelAvailability,
  type ServerModelStatus,
} from './serverQuota'

/**
 * Server-side (Next.js) access to the Convex usage limits for server-key models. Signed-in callers
 * are counted by their Convex identity; guests by a keyed hash of their IP, with signed requests.
 */

const convexUrl = () => process.env.NEXT_PUBLIC_CONVEX_URL!

/** Client IP as seen by Vercel's edge (it overwrites these headers), or a shared bucket if unknown. */
export const clientIp = (headers: Headers) =>
  headers.get('x-real-ip') || headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

/** Whether this Next.js deployment has the server key the model runs on. */
export const hasServerKey = (modelId: string) => {
  const model = models.find((m) => m.id === modelId)
  const envVar = model && serverKeyEnvVar(model)
  return !!(envVar && process.env[envVar])
}

/** Counts one request against the limits. Fails closed: no answer from Convex means no request. */
export async function consumeServerQuota(
  modelId: string,
  caller: { token?: string; ip: string },
): Promise<ServerModelStatus> {
  try {
    const client = new ConvexHttpClient(convexUrl())
    if (caller.token) {
      client.setAuth(caller.token)
      return await client.mutation(api.serverQuota.consumeForUser, { modelId })
    }
    const secret = quotaSecret()
    if (!secret) return { available: false, reason: 'no-key' }
    const subject = await guestSubject(secret, caller.ip)
    const { action: _action, ...signed } = await signQuotaRequest(secret, { subject, modelId, action: 'consume' })
    return await client.mutation(api.serverQuota.consumeForGuest, signed)
  } catch (error) {
    console.error('Usage limit check failed:', error instanceof Error ? error.name : 'Error')
    return { available: false, reason: 'limit' }
  }
}

/** Pauses a model for everyone after the provider rate-limited the server key. Best effort. */
export async function reportProviderLimit(modelId: string) {
  const secret = quotaSecret()
  if (!secret) return
  try {
    const { action: _action, ...signed } = await signQuotaRequest(secret, {
      subject: 'server',
      modelId,
      action: 'cooldown',
    })
    await new ConvexHttpClient(convexUrl()).mutation(api.serverQuota.reportProviderLimit, signed)
  } catch {
    // Best effort: the model simply stays visible until the next limit check
  }
}

/** Availability of each server-key model for a guest: this deployment's keys plus the Convex limits. */
export async function guestModelAvailability(ip: string): Promise<ServerModelAvailability> {
  const result: ServerModelAvailability = {}
  const secret = quotaSecret()
  let limits: ServerModelAvailability | null = null
  if (secret) {
    try {
      const subject = await guestSubject(secret, ip)
      limits = await new ConvexHttpClient(convexUrl()).query(api.serverQuota.getGuestModelLimits, { subject })
    } catch {
      limits = null
    }
  }
  for (const model of serverKeyModels) {
    if (!hasServerKey(model.id) || !secret) result[model.id] = { available: false, reason: 'no-key' }
    // Without the limits (no secret, or Convex unreachable) requests would be refused anyway
    else result[model.id] = limits?.[model.id] ?? { available: false, reason: 'limit' }
  }
  return result
}
