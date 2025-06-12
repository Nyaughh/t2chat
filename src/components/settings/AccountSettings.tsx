import React from 'react'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { motion } from 'framer-motion'
import { authClient } from '@/lib/auth-client'
import Image from 'next/image'
interface AccountSettingsProps {
  user: {
    name: string
    email: string
    image: string
  }
}

export function AccountSettings({ user }: AccountSettingsProps) {

  const handleSignOut = async () => {
    await authClient.signOut()
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-black/80 dark:text-white/80">My Profile</h3>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500/20 to-rose-600/20 dark:from-rose-300/20 dark:to-rose-400/20 flex items-center justify-center flex-shrink-0">
              <Image src={user.image} alt={user.name} width={40} height={40} className="rounded-full" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-black/80 dark:text-white/80 capitalize">{user.name}</div>
              <div className="text-sm text-black/60 dark:text-white/60">{user.email}</div>
            </div>
          </div>
        </div>

        {/* Plan section */}
        <div>
          <h3 className="text-lg font-semibold text-black/80 dark:text-white/80">My Plan</h3>
          <div className="mt-3 p-4 rounded-lg bg-black/5 dark:bg-white/5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-base text-black/80 dark:text-white/80 capitalize">Free Plan</div>
                <p className="text-sm text-black/60 dark:text-white/60">You have access to all features.</p>
              </div>
              <Button>Upgrade to Pro</Button>
            </div>
          </div>
        </div>

        {/* Account actions */}
        <div className="space-y-2">
            <Button variant="outline" className="w-full justify-start text-base" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-3" />
              Sign Out
            </Button>
        </div>
      </motion.div>
    </div>
  )
}

