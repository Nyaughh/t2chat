import { authClient } from "@/lib/auth-client";

export const signInWithDiscord = async () => {
   const data = await authClient.signIn.social({
      provider: "discord",
      callbackURL: '/'
   })
}

export const signInWithGithub = async () => {
   const data = await authClient.signIn.social({
      provider: "github",
      callbackURL: '/'
   })
}