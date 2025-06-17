import {
  BetterAuth,
  convexAdapter,
  type AuthFunctions,
  type PublicAuthFunctions,
} from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth";
import { api, components, internal } from "./_generated/api";
import { internalMutation, query, type GenericCtx } from "./_generated/server";
import type { Id, DataModel } from "./_generated/dataModel";
import { v } from "convex/values";

// Typesafe way to pass Convex functions defined in this file
const authFunctions: AuthFunctions = internal.auth;
const publicAuthFunctions: PublicAuthFunctions = api.auth;

// Initialize the component
export const betterAuthComponent = new BetterAuth(
  components.betterAuth,
  {
    authFunctions,
    publicAuthFunctions,
  }
);

export const createAuth = (ctx: GenericCtx) =>
  // Configure your Better Auth instance here
  betterAuth({
    // All auth requests will be proxied through your next.js server
    baseURL: process.env.BETTER_AUTH_URL!,
    database: convexAdapter(ctx, betterAuthComponent),
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
      enabled: false
    },
    plugins: [
      // The Convex plugin is required
      convex(),
    ],
  });


// These are required named exports
export const {
  createUser,
  updateUser,
  deleteUser,
  createSession,
  isAuthenticated,
} =
  betterAuthComponent.createAuthFunctions<DataModel>({
    // Must create a user and return the user id
    onCreateUser: async (ctx, user) => {
      const userId = await ctx.db.insert("users", {
        name: user.name,
        email: user.email,
      });
      await ctx.scheduler.runAfter(0, internal.auth.storeUser, {
        betterAuthId: user.email,
        userId: userId,
      })
      return userId
    },

    // Delete the user when they are deleted from Better Auth
    onDeleteUser: async (ctx, userId) => {
      await ctx.db.delete(userId as Id<"users">);
    },
  });

export const storeUser = internalMutation({
  args: { betterAuthId: v.string(), userId: v.id("users") },
  handler: async (ctx, { betterAuthId, userId }) => {
    await (betterAuthComponent as any).storeUser(ctx, betterAuthId, userId);
  },
});

// Example function for getting the current user
// Feel free to edit, omit, etc.
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    // Get user data from Better Auth - email, name, image, etc.
    const userMetadata = await betterAuthComponent.getAuthUser(ctx);
    if (!userMetadata) {
      return null;
    }
    // Get user data from your application's database
    // (skip this if you have no fields in your users table schema)
    const user = await ctx.db.get(userMetadata.userId as Id<"users">);
    return {
      ...user,
      ...userMetadata,
    };
  },
});

export const getOrCreateUser = internalMutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (user) {
      return user._id;
    }

    const userId = await ctx.db.insert("users", {
      name: identity.name!,
      email: identity.email!,
      image: identity.pictureUrl!,
      tokenIdentifier: identity.tokenIdentifier,
    });

    return userId;
  },
});