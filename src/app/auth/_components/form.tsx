
"use client"

import { Button } from "@/components/ui/button"
import { signInWithDiscord, signInWithGithub } from "./authAction"

export default function SignInForm() {
   return (
      <div>
         <Button onClick={signInWithDiscord}>Sign in with Discord</Button>
         <Button onClick={signInWithGithub}>Sign in with Github</Button>
      </div>
   )
}