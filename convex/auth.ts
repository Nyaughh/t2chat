import { createClient, type AuthFunctions, type GenericCtx } from '@convex-dev/better-auth'
import { convex } from '@convex-dev/better-auth/plugins'
import { betterAuth } from 'better-auth'
import { customSession } from 'better-auth/plugins'
import { components, internal } from './_generated/api'
import { query } from './_generated/server'
import type { Id, DataModel } from './_generated/dataModel'
import authConfig from './auth.config'

// Typesafe way to pass Convex functions defined in this file
const authFunctions: AuthFunctions = internal.auth

// The Better Auth component keeps its own user table. Each Better Auth user
// stores this app's `users` id in `userId` (the 0.7 layout, kept so existing
// accounts and every table keyed by `users` ids need no data migration).
export const authComponent = createClient<DataModel>(components.betterAuth, {
  authFunctions,
  triggers: {
    user: {
      onCreate: async (ctx, authUser) => {
        const userId = await ctx.db.insert('users', {
          name: authUser.name,
          email: authUser.email,
        })
        await authComponent.setUserId(ctx, authUser._id, userId)
      },
      onDelete: async (ctx, authUser) => {
        if (authUser.userId) await ctx.db.delete(authUser.userId as Id<'users'>)
      },
    },
  },
})

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi()

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    // All auth requests are proxied through the Next.js server
    baseURL: process.env.BETTER_AUTH_URL!,
    database: authComponent.adapter(ctx),
    socialProviders: {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID!,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      },
      discord: {
        clientId: process.env.DISCORD_CLIENT_ID!,
        clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      },
    },
    emailAndPassword: {
      enabled: false,
    },
    plugins: [
      // The Convex plugin is required. Tokens are now RS256 (customJwt auth
      // config); the pre-0.10 EdDSA key is replaced on the first token request.
      convex({ authConfig, jwksRotateOnTokenGenerationError: true }),
      // Before 0.8 the session's `user.id` was this app's `users` id, and the
      // client still uses it as the owner of chats and local data
      // (sessionStateFrom). Keep reporting that id so clients, including tabs
      // opened before this upgrade, see the same identity. Only the
      // /get-session response changes; Convex tokens use the real session.
      customSession(async ({ user, session }) => ({
        user: { ...user, id: (user as { userId?: string | null }).userId || user.id },
        session,
      })),
    ],
  })

/**
 * The signed-in user's id in this app's `users` table, or null.
 *
 * Before 0.8 this was the token subject. The subject is now the Better Auth
 * user id, but the token payload still carries the Better Auth user's fields,
 * including `userId`, so this stays a token read. Users without the claim
 * fall back to a component lookup.
 */
export async function getAuthUserId(ctx: GenericCtx<DataModel>): Promise<Id<'users'> | null> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null
  if (typeof identity.userId === 'string' && identity.userId) return identity.userId as Id<'users'>
  const authUser = await authComponent.safeGetAuthUser(ctx)
  return (authUser?.userId as Id<'users'> | undefined) ?? null
}

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    // Better Auth user data: email, name, image, etc.
    const userMetadata = await authComponent.safeGetAuthUser(ctx)
    if (!userMetadata) {
      return null
    }
    // App user data (the `users` row linked through `userId`)
    const user = userMetadata.userId ? await ctx.db.get(userMetadata.userId as Id<'users'>) : null
    return {
      ...user,
      ...userMetadata,
    }
  },
})
