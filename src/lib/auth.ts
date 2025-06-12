import { Pool } from 'pg'
import { betterAuth } from 'better-auth'
import { admin } from 'better-auth/plugins'
import { nextCookies } from 'better-auth/next-js'

export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),

  emailAndPassword: {
    enabled: false,
  },
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
  plugins: [admin(), nextCookies()],
})


export const signInWithDiscord = async () => {
  "use server"
  return await auth.api.signInSocial({
    body: {
      provider: 'discord',
    },
  })
}

export const signInWithGithub = async () => {
  "use server"
  return await auth.api.signInSocial({
    body: {
      provider: 'github',
    },
  })
}