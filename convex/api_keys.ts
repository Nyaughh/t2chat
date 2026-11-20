import { query, mutation, action, internalMutation, internalQuery, type ActionCtx } from './_generated/server'
import { internal } from './_generated/api'
import { ConvexError, v, type Infer } from 'convex/values'
import { Doc, Id } from './_generated/dataModel'
import { betterAuthComponent } from './auth'
import { DEFAULT_MODEL_ID } from '../src/lib/models'

export const apiKeyServiceValidator = v.union(
  v.literal('gemini'),
  v.literal('groq'),
  v.literal('openrouter'),
  v.literal('anthropic'),
  v.literal('openai'),
  v.literal('deepgram'),
)

export type ApiKeyService = Infer<typeof apiKeyServiceValidator>

// ---------------------------------------------------------------------------
// Encryption at rest
//
// Keys are encrypted with AES-256-GCM using a key derived from the
// API_KEY_ENCRYPTION_SECRET deployment env var. The ciphertext is bound to the
// owning user and service (AES-GCM additional data), so a stored value can't be
// decrypted for another user or provider. Rows saved before encryption existed
// are plain text (no prefix) and are still read as-is.
// ---------------------------------------------------------------------------

const ENCRYPTED_PREFIX = 'enc:v1:'

const toBase64 = (bytes: Uint8Array) => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

const fromBase64 = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0))

const getEncryptionKey = async () => {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET
  if (!secret || secret.length < 32) {
    throw new ConvexError('API key storage is not configured on the server. Please contact the site administrator.')
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

const additionalData = (userId: string, service: ApiKeyService) => new TextEncoder().encode(`${userId}:${service}`)

/** Encrypts an API key for storage. Only call from actions. */
export const encryptApiKey = async (plainKey: string, userId: string, service: ApiKeyService) => {
  const key = await getEncryptionKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: additionalData(userId, service) },
    key,
    new TextEncoder().encode(plainKey),
  )
  return `${ENCRYPTED_PREFIX}${toBase64(iv)}:${toBase64(new Uint8Array(ciphertext))}`
}

/** Decrypts a stored API key. Only call from actions; never return the result to a client. */
export const decryptApiKey = async (storedKey: string, userId: string, service: ApiKeyService) => {
  if (!storedKey.startsWith(ENCRYPTED_PREFIX)) return storedKey // legacy plain-text row
  const [ivPart, dataPart] = storedKey.slice(ENCRYPTED_PREFIX.length).split(':')
  try {
    const key = await getEncryptionKey()
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(ivPart), additionalData: additionalData(userId, service) },
      key,
      fromBase64(dataPart),
    )
    return new TextDecoder().decode(plaintext)
  } catch (error) {
    if (error instanceof ConvexError) throw error
    throw new ConvexError(`Your saved ${service} API key could not be read. Please remove it and add it again.`)
  }
}

const keyHintFor = (plainKey: string) => plainKey.slice(-4)

/** What clients may see about a stored key: never the key itself. */
const toPublicApiKey = (doc: Doc<'apiKeys'>) => ({
  _id: doc._id,
  _creationTime: doc._creationTime,
  service: doc.service,
  name: doc.name,
  is_default: doc.is_default,
  keyHint: doc.keyHint ?? (doc.key.startsWith(ENCRYPTED_PREFIX) ? '' : keyHintFor(doc.key)),
})

export type PublicApiKey = ReturnType<typeof toPublicApiKey>

// ---------------------------------------------------------------------------
// Key validation against the provider (only for providers with a free,
// side-effect-free endpoint). A network problem doesn't block saving.
// ---------------------------------------------------------------------------

const verifyProviderKey = async (service: ApiKeyService, key: string) => {
  let response: Response
  try {
    if (service === 'anthropic') {
      response = await fetch('https://api.anthropic.com/v1/models?limit=1', {
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      })
    } else if (service === 'openai') {
      response = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` },
      })
    } else {
      return
    }
  } catch {
    return
  }
  if (response.status === 401 || response.status === 403) {
    throw new ConvexError(`That ${service === 'openai' ? 'OpenAI' : 'Anthropic'} API key was rejected. Check it and try again.`)
  }
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

export const getApiKeys = query({
  args: {},
  handler: async (ctx) => {
    const userId = await betterAuthComponent.getAuthUserId(ctx)
    if (!userId) {
      return []
    }

    const keys = await ctx.db
      .query('apiKeys')
      .withIndex('by_user_and_service', (q) => q.eq('userId', userId as Id<'users'>))
      .collect()

    return keys.map(toPublicApiKey)
  },
})

export const hasApiKeyForProvider = query({
  args: {
    provider: apiKeyServiceValidator,
  },
  handler: async (ctx, { provider }) => {
    const userId = await betterAuthComponent.getAuthUserId(ctx)
    if (!userId) {
      return false
    }

    const apiKey = await ctx.db
      .query('apiKeys')
      .withIndex('by_user_and_service', (q) => q.eq('userId', userId as Id<'users'>).eq('service', provider))
      .first()

    return !!apiKey
  },
})

/**
 * Adds a key, or renames / replaces an existing one. The key is validated
 * (where possible) and encrypted here, then stored by an internal mutation.
 * When editing, an empty `key` keeps the stored key and only renames it.
 */
export const saveApiKey = action({
  args: {
    _id: v.optional(v.id('apiKeys')),
    name: v.string(),
    service: apiKeyServiceValidator,
    key: v.optional(v.string()),
  },
  handler: async (ctx, { _id, name, service, key }): Promise<null> => {
    const userId = await betterAuthComponent.getAuthUserId(ctx)
    if (!userId) throw new ConvexError('Not authenticated')

    const trimmedName = name.trim().slice(0, 100)
    if (!trimmedName) throw new ConvexError('Please give the key a name.')

    const trimmedKey = key?.trim() ?? ''
    if (!_id && !trimmedKey) throw new ConvexError('Please enter an API key.')

    let encrypted: { key: string; keyHint: string } | undefined
    if (trimmedKey) {
      if (trimmedKey.length < 8 || trimmedKey.length > 512 || /\s/.test(trimmedKey)) {
        throw new ConvexError("That doesn't look like a valid API key.")
      }
      await verifyProviderKey(service, trimmedKey)
      encrypted = { key: await encryptApiKey(trimmedKey, userId, service), keyHint: keyHintFor(trimmedKey) }
    }

    await ctx.runMutation(internal.api_keys.storeApiKey, {
      _id,
      name: trimmedName,
      service,
      ...encrypted,
    })
    return null
  },
})

export const deleteApiKey = mutation({
  args: { _id: v.id('apiKeys') },
  handler: async (ctx, { _id }) => {
    const userId = await betterAuthComponent.getAuthUserId(ctx)
    if (!userId) throw new Error('Not authenticated')

    const existingKey = await ctx.db.get(_id)
    if (existingKey?.userId !== userId) throw new Error('Not authorized to delete this key')

    const wasDefault = existingKey.is_default
    await ctx.db.delete(_id)

    // If we deleted the default key, set another key as default
    if (wasDefault) {
      const remainingKeys = await ctx.db
        .query('apiKeys')
        .withIndex('by_user_and_service', (q) =>
          q.eq('userId', userId as Id<'users'>).eq('service', existingKey.service),
        )
        .collect()

      if (remainingKeys.length > 0) {
        // Set the first remaining key as default
        await ctx.db.patch(remainingKeys[0]._id, { is_default: true })
      }
    }
  },
})

export const setDefaultApiKey = mutation({
  args: { _id: v.id('apiKeys') },
  handler: async (ctx, { _id }) => {
    const userId = await betterAuthComponent.getAuthUserId(ctx)
    if (!userId) throw new Error('Not authenticated')

    const targetKey = await ctx.db.get(_id)
    if (!targetKey || targetKey.userId !== userId) throw new Error('Key not found or not authorized')

    // Unset any other default key for the same service
    const otherDefaults = await ctx.db
      .query('apiKeys')
      .withIndex('by_user_and_service', (q) => q.eq('userId', userId as Id<'users'>).eq('service', targetKey.service))
      .filter((q) => q.eq(q.field('is_default'), true))
      .collect()

    for (const key of otherDefaults) {
      await ctx.db.patch(key._id, { is_default: false })
    }

    // Set the new default
    await ctx.db.patch(_id, { is_default: true })
  },
})

// ---------------------------------------------------------------------------
// Internal functions (not callable from clients)
// ---------------------------------------------------------------------------

export const storeApiKey = internalMutation({
  args: {
    _id: v.optional(v.id('apiKeys')),
    name: v.string(),
    service: apiKeyServiceValidator,
    key: v.optional(v.string()),
    keyHint: v.optional(v.string()),
  },
  handler: async (ctx, { _id, name, service, key, keyHint }) => {
    const userId = await betterAuthComponent.getAuthUserId(ctx)
    if (!userId) throw new ConvexError('Not authenticated')

    if (_id) {
      const existingKey = await ctx.db.get(_id)
      if (!existingKey || existingKey.userId !== userId) throw new ConvexError('Not authorized to edit this key')
      if (existingKey.service !== service) throw new ConvexError('A key cannot be moved to a different provider')
      await ctx.db.patch(_id, key ? { name, key, keyHint } : { name })
      return
    }

    if (!key) throw new ConvexError('Please enter an API key.')

    // The first key for a service becomes the default
    const existingKey = await ctx.db
      .query('apiKeys')
      .withIndex('by_user_and_service', (q) => q.eq('userId', userId as Id<'users'>).eq('service', service))
      .first()

    await ctx.db.insert('apiKeys', {
      userId: userId as Id<'users'>,
      name,
      service,
      key,
      keyHint,
      is_default: !existingKey,
    })
  },
})

/**
 * Returns the signed-in user's default key for a service, still encrypted, with
 * the owner id needed to decrypt it. Use `getUserApiKey` in actions instead.
 */
export const getStoredDefaultApiKey = internalQuery({
  args: {
    service: apiKeyServiceValidator,
  },
  handler: async (ctx, { service }) => {
    const userId = await betterAuthComponent.getAuthUserId(ctx)
    if (!userId) {
      return null
    }

    const keys = await ctx.db
      .query('apiKeys')
      .withIndex('by_user_and_service', (q) => q.eq('userId', userId as Id<'users'>).eq('service', service))
      .collect()

    const chosen = keys.find((k) => k.is_default) ?? keys[0]
    return chosen ? { userId: chosen.userId as string, storedKey: chosen.key } : null
  },
})

/** Loads and decrypts the signed-in user's default key for a service (actions only). */
export const getUserApiKey = async (
  ctx: Pick<ActionCtx, 'runQuery'>,
  service: ApiKeyService,
): Promise<string | null> => {
  const stored = await ctx.runQuery(internal.api_keys.getStoredDefaultApiKey, { service })
  if (!stored) return null
  return decryptApiKey(stored.storedKey, stored.userId, service)
}

export const getDisabledModels = query({
  args: {},
  handler: async (ctx) => {
    const userId = await betterAuthComponent.getAuthUserId(ctx)
    if (!userId) {
      return []
    }

    const userSettings = await ctx.db
      .query('userSettings')
      .withIndex('by_user', (q) => q.eq('userId', userId as Id<'users'>))
      .first()

    return userSettings?.disabledModels || []
  },
})

export const updateDisabledModels = mutation({
  args: {
    disabledModels: v.array(v.string()),
  },
  handler: async (ctx, { disabledModels }) => {
    const userId = await betterAuthComponent.getAuthUserId(ctx)
    if (!userId) throw new Error('Not authenticated')

    // Get or create user settings
    const existingSettings = await ctx.db
      .query('userSettings')
      .withIndex('by_user', (q) => q.eq('userId', userId as Id<'users'>))
      .first()

    disabledModels = disabledModels.filter((model) => model !== DEFAULT_MODEL_ID)

    if (existingSettings) {
      await ctx.db.patch(existingSettings._id, { disabledModels })
    } else {
      await ctx.db.insert('userSettings', {
        userId: userId as Id<'users'>,
        disabledModels,
      })
    }
  },
})
