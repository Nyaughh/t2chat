import { createAuthClient } from "better-auth/react"
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { crossDomain } from "@convex-dev/better-auth/plugins";

export const authClient = createAuthClient({
    baseURL: process.env.BETTER_AUTH_URL,
    plugins: [convexClient(), crossDomain({
        siteUrl: process.env.VERCEL_URL!
    })]
})

export const { useSession, signIn, signOut } = authClient
