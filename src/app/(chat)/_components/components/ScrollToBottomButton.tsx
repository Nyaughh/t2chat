'use client'

import { ChevronDown } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface ScrollToBottomButtonProps {
  show: boolean
  onScrollToBottom: () => void
}

export function ScrollToBottomButton({ show, onScrollToBottom }: ScrollToBottomButtonProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.9 }}
          transition={{ duration: 0.15, ease: [0.25, 1, 0.5, 1] }}
          className="fixed bottom-32 md:bottom-36 left-1/2 -translate-x-1/2 z-30"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onScrollToBottom}
                className="group flex items-center gap-1.5 rounded-full bg-white/80 dark:bg-[oklch(0.18_0.015_25)]/50 backdrop-blur-lg shadow-lg dark:shadow-2xl ring-1 ring-black/5 dark:ring-white/10 hover:bg-white/95 dark:hover:bg-[oklch(0.18_0.015_25)]/70 transition-all duration-150 ease-[0.25,1,0.5,1] px-3.5 py-2"
              >
                <ChevronDown className="w-4 h-4 text-black/60 dark:text-white/60 transition-transform duration-200 ease-in-out group-hover:translate-y-0.5" />
                <span className="text-sm font-medium text-black/70 dark:text-white/80">Scroll to bottom</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Jump to the latest message</TooltipContent>
          </Tooltip>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
