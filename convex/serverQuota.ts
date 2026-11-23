import { v } from 'convex/values'
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from './_generated/server'
import { getAuthUserId } from './auth'
import { models } from '../src/lib/models'
import {
  PROVIDER_COOLDOWN_MS,
  quotaSecret,
  quotaWindowStart,
  serverKeyEnvVar,
  serverKeyModels,
  serverModelLimits,
  verifyQuotaRequest,
  type ServerModelAvailability,
  type ServerModelStatus,
} from '../src/lib/serverQuota'

/**
 * Durable usage limits for models running on the server's API keys. Signed-in users are counted by
 * user id (Convex auth); guests by a keyed IP hash that only the Next.js server can sign for.
 */

type Subject = { kind: 'user' | 'guest'; id: string }

const usageKey = (subject: Subject, modelId: string) => `${subject.kind}:${subject.id}:${modelId}`
const globalKey = (modelId: string) => `global:${modelId}`

const readUsage = async (ctx: QueryCtx, key: string, now: number) => {
  const row = await ctx.db
    .query('serverUsage')
    .withIndex('by_key', (q) => q.eq('key', key))
    .first()
  const count = row && row.windowStart === quotaWindowStart(now) ? row.count : 0
  return { row, count }
}

const cooldownUntil = async (ctx: QueryCtx, modelId: string) => {
  const row = await ctx.db
    .query('modelCooldowns')
    .withIndex('by_model', (q) => q.eq('modelId', modelId))
    .first()
  return row?.until ?? 0
}

/** Limits only: cooldown and per-subject/global counts (the env key is checked by the caller). */
const limitStatus = async (ctx: QueryCtx, subject: Subject, modelId: string, now: number): Promise<ServerModelStatus> => {
  if ((await cooldownUntil(ctx, modelId)) > now) return { available: false, reason: 'cooldown' }
  const limits = serverModelLimits(modelId)
  const own = await readUsage(ctx, usageKey(subject, modelId), now)
  const global = await readUsage(ctx, globalKey(modelId), now)
  if (own.count >= limits[subject.kind] || global.count >= limits.global) return { available: false, reason: 'limit' }
  return { available: true }
}

const increment = async (ctx: MutationCtx, key: string, now: number) => {
  const { row, count } = await readUsage(ctx, key, now)
  const windowStart = quotaWindowStart(now)
  if (row) await ctx.db.patch(row._id, { windowStart, count: count + 1 })
  else await ctx.db.insert('serverUsage', { key, windowStart, count: 1 })
}

const consume = async (ctx: MutationCtx, subject: Subject, modelId: string): Promise<ServerModelStatus> => {
  if (!serverKeyModels.some((model) => model.id === modelId)) return { available: false, reason: 'no-key' }
  const now = Date.now()
  const status = await limitStatus(ctx, subject, modelId, now)
  if (!status.available) return status
  await increment(ctx, usageKey(subject, modelId), now)
  await increment(ctx, globalKey(modelId), now)
  return status
}

const startCooldown = async (ctx: MutationCtx, modelId: string) => {
  if (!serverKeyModels.some((model) => model.id === modelId)) return
  const until = Date.now() + PROVIDER_COOLDOWN_MS
  const row = await ctx.db
    .query('modelCooldowns')
    .withIndex('by_model', (q) => q.eq('modelId', modelId))
    .first()
  if (row) await ctx.db.patch(row._id, { until })
  else await ctx.db.insert('modelCooldowns', { modelId, until })
}

const availabilityFor = async (
  ctx: QueryCtx,
  subject: Subject,
  hasEnvKey: (envVar: string) => boolean,
): Promise<ServerModelAvailability> => {
  const now = Date.now()
  const result: ServerModelAvailability = {}
  for (const model of serverKeyModels) {
    const envVar = serverKeyEnvVar(model)
    result[model.id] =
      envVar && hasEnvKey(envVar) ? await limitStatus(ctx, subject, model.id, now) : { available: false, reason: 'no-key' }
  }
  return result
}

/**
 * Server-key model availability for the signed-in user (Convex chat path, which uses the Convex env keys).
 * `minute` only exists so clients re-subscribe periodically and see cooldowns and windows expire.
 */
export const getServerModelAvailability = query({
  args: { minute: v.optional(v.number()) },
  handler: async (ctx): Promise<ServerModelAvailability | null> => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return null
    return availabilityFor(ctx, { kind: 'user', id: userId }, (envVar) => !!process.env[envVar])
  },
})

/**
 * Limits for a guest, for /api/models/availability (which checks the Next.js env keys itself and
 * reports every server-key model as available here). Reveals only counters for an opaque id.
 */
export const getGuestModelLimits = query({
  args: { subject: v.string() },
  handler: async (ctx, { subject }): Promise<ServerModelAvailability> =>
    availabilityFor(ctx, { kind: 'guest', id: subject.slice(0, 64) }, () => true),
})

/** Counts one server-key request for the signed-in caller (Convex actions and /api/chat). */
export const consumeForUser = mutation({
  args: { modelId: v.string() },
  handler: async (ctx, { modelId }): Promise<ServerModelStatus> => {
    const userId = await getAuthUserId(ctx)
    if (!userId) return { available: false, reason: 'limit' }
    return consume(ctx, { kind: 'user', id: userId }, modelId)
  },
})

const signedArgs = { subject: v.string(), modelId: v.string(), ts: v.number(), sig: v.string() }

/** Counts one server-key request for a guest. Only /api/chat can sign these. */
export const consumeForGuest = mutation({
  args: signedArgs,
  handler: async (ctx, request): Promise<ServerModelStatus> => {
    if (!(await verifyQuotaRequest(quotaSecret(), { ...request, action: 'consume' }))) {
      return { available: false, reason: 'limit' }
    }
    return consume(ctx, { kind: 'guest', id: request.subject.slice(0, 64) }, request.modelId)
  },
})

/** Pauses a server-key model after the provider rate-limited the server key (signed by /api/chat). */
export const reportProviderLimit = mutation({
  args: signedArgs,
  handler: async (ctx, request) => {
    if (!(await verifyQuotaRequest(quotaSecret(), { ...request, action: 'cooldown' }))) return
    await startCooldown(ctx, request.modelId)
  },
})

/** Same, from the Convex chat path. */
export const startProviderCooldown = internalMutation({
  args: { modelId: v.string() },
  handler: async (ctx, { modelId }) => {
    if (models.some((model) => model.id === modelId)) await startCooldown(ctx, modelId)
  },
})
