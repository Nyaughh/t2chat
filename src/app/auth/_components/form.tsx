
"use client"

import { Button } from "@/components/ui/button"
import {
   Card,
   CardContent,
   CardDescription,
   CardFooter,
   CardHeader,
   CardTitle,
} from "@/components/ui/card"

import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"
import { signInWithDiscord, signInWithGithub } from "./authAction"

export default function SignInForm() {
   return (
      <div>
         <Button onClick={signInWithDiscord}>Sign in with Discord</Button>
         <Button onClick={signInWithGithub}>Sign in with Github</Button>
      </div>
   )
}