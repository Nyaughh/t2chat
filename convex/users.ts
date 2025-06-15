import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getUserSettings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();

    if (!user) {
      return null;
    }

    return await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
  },
});

export const updateUserSettings = mutation({
  args: {
    use_keys_for_gemini: v.optional(v.boolean()),
    use_keys_for_groq: v.optional(v.boolean()),
    use_keys_for_openrouter: v.optional(v.boolean()),
    use_keys_for_uploadthing: v.optional(v.boolean()),
    use_keys_for_tavily: v.optional(v.boolean()),
    uploadthing_key: v.optional(v.string()),
    tavily_key: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) throw new Error("User not found");
    
    const settings = await ctx.db
        .query("userSettings")
        .withIndex("by_user", q => q.eq("userId", user._id))
        .unique();

    if (settings) {
        await ctx.db.patch(settings._id, args);
    } else {
        await ctx.db.insert("userSettings", { userId: user._id, ...args });
    }
  }
}) 