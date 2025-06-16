import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

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
    userName: v.optional(v.string()),
    userRole: v.optional(v.string()),
    userTraits: v.optional(v.array(v.string())),
    userAdditionalInfo: v.optional(v.string()),
    promptTemplate: v.optional(v.string()),
    mainFont: v.optional(v.union(v.literal('inter'), v.literal('system'), v.literal('serif'), v.literal('mono'), v.literal('roboto-slab'))),
    codeFont: v.optional(v.union(v.literal('fira-code'), v.literal('mono'), v.literal('consolas'), v.literal('jetbrains'), v.literal('source-code-pro'))),
    sendBehavior: v.optional(v.union(v.literal('enter'), v.literal('shiftEnter'), v.literal('button'))),
    autoSave: v.optional(v.boolean()),
    showTimestamps: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.scheduler.runNow(internal.auth.getOrCreateUser, {});
    
    const settings = await ctx.db
        .query("userSettings")
        .withIndex("by_user", q => q.eq("userId", userId))
        .unique();

    if (settings) {
        await ctx.db.patch(settings._id, args);
    } else {
        await ctx.db.insert("userSettings", { userId, ...args });
    }
  }
}) 