import React from 'react'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { motion } from 'framer-motion'
import { UserButton } from '@clerk/nextjs'

interface UserProfile {
  name: string
  email: string
  avatar?: string
  plan: 'free' | 'pro'
}


export function AccountSettings() {
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-black/80 dark:text-white/80">My Profile</h3>
          <UserButton />
         
        </div>

        {/* Plan section */}
        <div>
          <h3 className="text-lg font-semibold text-black/80 dark:text-white/80">My Plan</h3>
          <div className="mt-3 p-4 rounded-lg bg-black/5 dark:bg-white/5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-base text-black/80 dark:text-white/80 capitalize">Free Plan</div>
                <p className="text-sm text-black/60 dark:text-white/60">
                  You have access to all features.
                </p>
              </div>
              <Button>
                Upgrade to Pro
              </Button>
            </div>
          </div>
        </div>

        {/* Account actions */}
        <div className="space-y-2">
          <Button variant="outline" className="w-full justify-start text-base">
            <LogOut className="w-4 h-4 mr-3" />
            Sign Out
          </Button>
        </div>
      </motion.div>
    </div>
  )
} 