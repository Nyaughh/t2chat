import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { LogOut, Crown, User, Mail, Eye, EyeOff } from 'lucide-react'
import { motion } from 'framer-motion'
import { authClient } from '@/lib/auth-client'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Switch } from '../ui/switch'
import { cn } from '@/lib/utils'

interface AccountSettingsProps {
  user: {
    name: string
    email: string
    image: string
  }
}

export function AccountSettings({ user }: AccountSettingsProps) {
  const router = useRouter()
  const [showName, setShowName] = useState(true)
  const [showEmail, setShowEmail] = useState(true)

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push('/')
        },
      },
    })
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
        className="space-y-6"
      >
        {/* Profile Section */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-rose-500/20 to-rose-600/20 dark:from-rose-300/20 dark:to-rose-400/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
              <Image src={user.image} alt={user.name} width={64} height={64} className="rounded-full" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div
              className={cn(
                'text-lg font-semibold text-black/90 dark:text-white/90 capitalize transition-all duration-200',
                !showName && 'blur-sm select-none',
              )}
            >
              {user.name}
            </div>
            <div
              className={cn(
                'text-sm text-black/50 dark:text-white/50 transition-all duration-200',
                !showEmail && 'blur-sm select-none',
              )}
            >
              {user.email}
            </div>
          </div>
        </div>

        {/* Privacy Settings */}
        <div className="space-y-4">
            <h3 className="text-base font-semibold text-black/80 dark:text-white/80">Privacy</h3>
            <div className="p-4 rounded-xl bg-gradient-to-br from-rose-500/5 via-transparent to-rose-500/10 dark:from-rose-300/5 dark:via-transparent dark:to-rose-300/10 border border-rose-500/10 dark:border-rose-300/10 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <User className="w-4 h-4 text-black/60 dark:text-white/60" />
                        <span className="text-sm text-black/80 dark:text-white/80">Display your name</span>
                    </div>
                    <Switch checked={showName} onCheckedChange={setShowName} />
                </div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Mail className="w-4 h-4 text-black/60 dark:text-white/60" />
                        <span className="text-sm text-black/80 dark:text-white/80">Display your email</span>
                    </div>
                    <Switch checked={showEmail} onCheckedChange={setShowEmail} />
                </div>
            </div>
        </div>


        {/* Plan Section */}
        <div className="space-y-4">
            <h3 className="text-base font-semibold text-black/80 dark:text-white/80">Subscription</h3>
            <div className="p-4 rounded-xl bg-gradient-to-br from-rose-500/5 via-transparent to-rose-500/10 dark:from-rose-300/5 dark:via-transparent dark:to-rose-300/10 border border-rose-500/10 dark:border-rose-300/10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-500/20 to-rose-600/20 dark:from-rose-300/20 dark:to-rose-400/20 flex items-center justify-center">
                        <Crown className="w-4 h-4 text-rose-600 dark:text-rose-300" />
                    </div>
                    <div>
                        <div className="font-semibold text-black/90 dark:text-white/90">Free Plan</div>
                        <p className="text-sm text-black/50 dark:text-white/50">Upgrade to Pro for premium features</p>
                    </div>
                    </div>
                    <Button size="sm" className="bg-gradient-to-r from-rose-500 to-rose-600 dark:from-rose-400 dark:to-rose-500 text-white hover:from-rose-600 hover:to-rose-700 dark:hover:from-rose-500 dark:hover:to-rose-600">
                    Upgrade
                    </Button>
                </div>
            </div>
        </div>


        {/* Sign Out Button */}
        <Button
          variant="outline"
          className="w-full justify-start text-base border-rose-500/20 dark:border-rose-300/20 hover:bg-rose-500/5 dark:hover:bg-rose-300/5"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4 mr-3 text-rose-600 dark:text-rose-300" />
          Sign Out
        </Button>
      </motion.div>
    </div>
  )
}

