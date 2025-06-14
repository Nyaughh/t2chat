import {
    BetterAuth,
    convexAdapter,
    type AuthFunctions,
    type PublicAuthFunctions,
  } from "@convex-dev/better-auth";
  import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
  import { betterAuth } from "better-auth";
  import { api, components, internal } from "./_generated/api";
  import { query, type GenericCtx } from "./_generated/server";
  import type { Id, DataModel } from "./_generated/dataModel";
  
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
    betterAuth({
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
        convex(),
        crossDomain({
          siteUrl: process.env.VERCEL_URL!
        })
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
      onCreateUser: async (ctx, user) => {
        // Generate a unique token identifier for the user
        const tokenIdentifier = `${user.email}_${Date.now()}`;
        return ctx.db.insert("users", {
          name: user.name,
          email: user.email,
          image: user.image,
          tokenIdentifier,
        });
      },
  
      onDeleteUser: async (ctx, userId) => {
        await ctx.db.delete(userId as Id<"users">);
      },
    });
  
  export const getCurrentUser = query({
    args: {},
    handler: async (ctx) => {
      const userMetadata = await betterAuthComponent.getAuthUser(ctx);
      if (!userMetadata) {
        return null;
      }
      const user = await ctx.db.get(userMetadata.userId as Id<"users">);
      return {
        ...user,
        ...userMetadata,
      };
    },
  });