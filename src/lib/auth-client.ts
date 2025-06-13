import { createAuthClient } from "better-auth/react"
import { convexClient } from "@convex-dev/better-auth/client/plugins";

export const authClient = createAuthClient({
    baseURL: process.env.BETTER_AUTH_URL,
    plugins: [convexClient()],
    trustedOrigins: [
        "http://localhost:3000",
        "*",
    ],
})

export const { useSession, signIn, signOut } = authClient
