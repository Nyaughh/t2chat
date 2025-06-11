import React from 'react'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { motion } from 'framer-motion'

interface UserProfile {
  name: string
  email: string
  avatar?: string
  plan: 'free' | 'pro'
}

interface AccountSettingsProps {
  userProfile: UserProfile
}

export function AccountSettings({ userProfile }: AccountSettingsProps) {
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        {/* User profile section */}
        <div>
          <h3 className="text-lg font-semibold text-black/80 dark:text-white/80">My Profile</h3>
          <div className="mt-3 p-3 rounded-lg bg-gradient-to-r from-rose-500/5 via-transparent to-rose-500/5 dark:from-rose-300/5 dark:via-transparent dark:to-rose-300/5 border border-rose-500/10 dark:border-rose-300/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-500 to-rose-600 dark:from-rose-300 dark:to-rose-400 flex items-center justify-center text-white text-xl font-bold">
                {userProfile.name.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-base text-black/80 dark:text-white/80">{userProfile.name}</div>
                <div className="text-sm text-black/60 dark:text-white/60">{userProfile.email}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Plan section */}
        <div>
          <h3 className="text-lg font-semibold text-black/80 dark:text-white/80">My Plan</h3>
          <div className="mt-3 p-4 rounded-lg bg-black/5 dark:bg-white/5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-base text-black/80 dark:text-white/80 capitalize">{userProfile.plan} Plan</div>
                <p className="text-sm text-black/60 dark:text-white/60">
                  {userProfile.plan === 'free' ? 'Unlock more features with Pro.' : 'You have access to all features.'}
                </p>
              </div>
              <Button>
                {userProfile.plan === 'free' ? 'Upgrade to Pro' : 'Manage Subscription'}
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