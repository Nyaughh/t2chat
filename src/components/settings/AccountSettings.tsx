import React, { useState, useEffect } from 'react'
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
  // Initialize state with localStorage values or defaults
  const [showName, setShowName] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('privacy-show-name')
      return saved !== null ? saved === 'true' : true
    }
    return true
  })

  const [showEmail, setShowEmail] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('privacy-show-email')
      return saved !== null ? saved === 'true' : true
    }
    return true
  })

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('privacy-show-name', showName.toString())
    }
  }, [showName])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('privacy-show-email', showEmail.toString())
    }
  }, [showEmail])

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
        className="space-y-6"
      >
        {/* Profile Section */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Profile
          </h3>

          <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/20 backdrop-blur-sm border border-border/50">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-rose-500/20 to-rose-600/20 dark:from-rose-300/20 dark:to-rose-400/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                <Image src={user.image} alt={user.name} width={64} height={64} className="rounded-full" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-lg font-semibold text-foreground capitalize transition-all duration-200">
                {showName ? user.name : '••••••••'}
              </div>
              <div className="overflow-hidden">
                <div
                  className={cn(
                    'text-muted-foreground transition-all duration-200 text-sm whitespace-nowrap',
                    showEmail && user.email.length > 30 && 'animate-[scroll-x_8s_linear_infinite]',
                  )}
                >
                  {showEmail ? user.email : '••••••••••••••••••••'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Privacy Settings */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Privacy
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 backdrop-blur-sm border border-border/50">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-muted-foreground" />
                <div>
                  <span className="text-sm font-medium text-foreground">Display your name</span>
                  <p className="text-xs text-muted-foreground">Show your name in conversations</p>
                </div>
              </div>
              <Switch checked={showName} onCheckedChange={setShowName} />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 backdrop-blur-sm border border-border/50">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-muted-foreground" />
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

      <style jsx global>{`
        @keyframes scroll-x {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  )
}
