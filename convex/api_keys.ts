import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getOneFrom } from "convex-helpers/server/relationships";
import { Id } from "./_generated/dataModel";
import { betterAuthComponent } from "./auth";

export const getApiKeys = query({
  args: {},
  handler: async (ctx) => {
    const userId = await betterAuthComponent.getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    return await ctx.db
      .query("apiKeys")
      .withIndex("by_user_and_service", (q) => q.eq("userId", userId as Id<"users">))
      .collect();
  },
});

export const saveApiKey = mutation({
    args: {
        _id: v.optional(v.id("apiKeys")),
        name: v.string(),
        service: v.union(v.literal("gemini"), v.literal("groq"), v.literal("openrouter"), v.literal("deepgram")),
        key: v.string(),
    },
    handler: async (ctx, { _id, name, service, key }) => {
        const userId = await betterAuthComponent.getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        if (_id) {
            // It's an update
            const existingKey = await ctx.db.get(_id);
            if (existingKey?.userId !== userId) throw new Error("Not authorized to edit this key");
            await ctx.db.patch(_id, { name, key });
        } else {
            // It's a new key
            await ctx.db.insert("apiKeys", { userId: userId as Id<"users">, name, service, key, is_default: false });
        }
    }
});

export const deleteApiKey = mutation({
    args: { _id: v.id("apiKeys") },
    handler: async (ctx, { _id }) => {
        const userId = await betterAuthComponent.getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const existingKey = await ctx.db.get(_id);
        if (existingKey?.userId !== userId) throw new Error("Not authorized to delete this key");
        
        await ctx.db.delete(_id);
    }
});

export const setDefaultApiKey = mutation({
    args: { _id: v.id("apiKeys") },
    handler: async (ctx, { _id }) => {
        const userId = await betterAuthComponent.getAuthUserId(ctx);
        if (!userId) throw new Error("Not authenticated");

        const targetKey = await ctx.db.get(_id);
        if (!targetKey || targetKey.userId !== userId) throw new Error("Key not found or not authorized");

        // Unset any other default key for the same service
        const otherDefaults = await ctx.db.query("apiKeys")
            .withIndex("by_user_and_service", q => q.eq("userId", userId as Id<"users">).eq("service", targetKey.service))
            .filter(q => q.eq(q.field("is_default"), true))
            .collect();
        
        for (const key of otherDefaults) {
            await ctx.db.patch(key._id, { is_default: false });
        }

        // Set the new default
        await ctx.db.patch(_id, { is_default: true });
    }
})

export const getUserDefaultApiKey = query({
    args: { 
        service: v.union(v.literal("gemini"), v.literal("groq"), v.literal("openrouter"), v.literal("deepgram"))
    },
    handler: async (ctx, { service }) => {
        const userId = await betterAuthComponent.getAuthUserId(ctx);
        if (!userId) {
            return null;
        }

        // First try to get the default key
        const defaultKey = await ctx.db
            .query("apiKeys")
            .withIndex("by_user_and_service", (q) => 
                q.eq("userId", userId as Id<"users">).eq("service", service)
            )
            .filter(q => q.eq(q.field("is_default"), true))
            .first();

        if (defaultKey) {
            return defaultKey.key;
        }

        // If no default key, get any key for the service
        const anyKey = await ctx.db
            .query("apiKeys")
            .withIndex("by_user_and_service", (q) => 
                q.eq("userId", userId as Id<"users">).eq("service", service)
            )
            .first();

        return anyKey?.key || null;
    },
}); 