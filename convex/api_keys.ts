import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getOneFrom } from "convex-helpers/server/relationships";
import { Id } from "./_generated/dataModel";

export const getApiKeys = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      return [];
    }

    return await ctx.db
      .query("apiKeys")
      .withIndex("by_user_and_service", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const saveApiKey = mutation({
    args: {
        _id: v.optional(v.id("apiKeys")),
        name: v.string(),
        service: v.union(v.literal("gemini"), v.literal("groq"), v.literal("openrouter")),
        key: v.string(),
    },
    handler: async (ctx, { _id, name, service, key }) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");
        const user = await ctx.db.query("users").withIndex("by_token", q => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
        if (!user) throw new Error("User not found");

        if (_id) {
            // It's an update
            const existingKey = await ctx.db.get(_id);
            if (existingKey?.userId !== user._id) throw new Error("Not authorized to edit this key");
            await ctx.db.patch(_id, { name, key });
        } else {
            // It's a new key
            await ctx.db.insert("apiKeys", { userId: user._id, name, service, key, is_default: false });
        }
    }
});

export const deleteApiKey = mutation({
    args: { _id: v.id("apiKeys") },
    handler: async (ctx, { _id }) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");
        const user = await ctx.db.query("users").withIndex("by_token", q => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
        if (!user) throw new Error("User not found");

        const existingKey = await ctx.db.get(_id);
        if (existingKey?.userId !== user._id) throw new Error("Not authorized to delete this key");
        
        await ctx.db.delete(_id);
    }
});

export const setDefaultApiKey = mutation({
    args: { _id: v.id("apiKeys") },
    handler: async (ctx, { _id }) => {
        const identity = await ctx.auth.getUserIdentity();
        if (!identity) throw new Error("Not authenticated");
        const user = await ctx.db.query("users").withIndex("by_token", q => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
        if (!user) throw new Error("User not found");

        const targetKey = await ctx.db.get(_id);
        if (!targetKey || targetKey.userId !== user._id) throw new Error("Key not found or not authorized");

        // Unset any other default key for the same service
        const otherDefaults = await ctx.db.query("apiKeys")
            .withIndex("by_user_and_service", q => q.eq("userId", user._id).eq("service", targetKey.service))
            .filter(q => q.eq(q.field("is_default"), true))
            .collect();
        
        for (const key of otherDefaults) {
            await ctx.db.patch(key._id, { is_default: false });
        }

        // Set the new default
        await ctx.db.patch(_id, { is_default: true });
    }
}) 