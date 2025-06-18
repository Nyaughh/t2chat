import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { User, Mail, Eye, EyeOff } from 'lucide-react'
import { motion } from 'framer-motion'
import Image from 'next/image'
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
  const [showName, setShowName] = useState(true)
  const [showEmail, setShowEmail] = useState(true)

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
        className="space-y-8"
      >
        {/* Profile Section */}
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-3 mb-6">
            <div className="relative">
              <User className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              <div className="absolute inset-0 bg-rose-500/20 blur-sm rounded-full scale-150 -z-10" />
            </div>
            Profile
          </h3>

          <div className="flex items-center gap-6 p-6 rounded-xl bg-muted/20 backdrop-blur-sm border border-border/50">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-rose-500/20 to-rose-600/20 dark:from-rose-300/20 dark:to-rose-400/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                <Image src={user.image} alt={user.name} width={80} height={80} className="rounded-full" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div
                className={cn(
                  'text-xl font-semibold text-foreground capitalize transition-all duration-200',
                  !showName && 'blur-sm select-none',
                )}
              >
                {user.name}
              </div>
              <div
                className={cn(
                  'text-muted-foreground transition-all duration-200 mt-1',
                  !showEmail && 'blur-sm select-none',
                )}
              >
                {user.email}
              </div>
            </div>
          </div>
        </div>

        {/* Privacy Settings */}
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-3 mb-6">
            <div className="relative">
              <Eye className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              <div className="absolute inset-0 bg-rose-500/20 blur-sm rounded-full scale-150 -z-10" />
            </div>
            Privacy
          </h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/20 backdrop-blur-sm border border-border/50">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-muted-foreground" />
                <div>
                  <span className="text-sm font-medium text-foreground">Display your name</span>
                  <p className="text-xs text-muted-foreground">Show your name in conversations</p>
                </div>
              </div>
              <Switch checked={showName} onCheckedChange={setShowName} />
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/20 backdrop-blur-sm border border-border/50">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-muted-foreground" />
                <div>
                  <span className="text-sm font-medium text-foreground">Display your email</span>
                  <p className="text-xs text-muted-foreground">Show your email in profile</p>
                </div>
              </div>
              <Switch checked={showEmail} onCheckedChange={setShowEmail} />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
