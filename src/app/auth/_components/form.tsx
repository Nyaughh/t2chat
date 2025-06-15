"use client"

import { Button } from "@/components/ui/button"
import { signInWithGithub } from "./authAction"
import { Github } from "lucide-react"

export default function SignInForm() {
   // The migration logic is now handled in ChatLayout after a successful sign-in.
   const handleSignIn = async () => {
      await signInWithGithub()
   }

   return (
      <div className="space-y-4">
         {/* GitHub Sign In */}
         <Button 
            onClick={handleSignIn}
            className="w-full h-12 bg-black hover:bg-black/90 text-white border-0 rounded-xl font-medium text-base transition-all duration-200 relative overflow-hidden group"
         >
            <div className="absolute inset-0 bg-gradient-to-r from-gray-800 to-black opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
            
            <div className="relative z-10 flex items-center justify-center gap-3">
               <Github className="w-5 h-5" />
               <span>Continue with GitHub</span>
            </div>
         </Button>
      </div>
   )
}