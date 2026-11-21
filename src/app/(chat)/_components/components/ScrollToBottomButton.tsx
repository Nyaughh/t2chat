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
          className="absolute bottom-32 md:bottom-36 left-1/2 -translate-x-1/2 z-30"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onScrollToBottom}
                aria-label="Scroll to bottom"
                className="surface-glass group flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-rose-600 transition-colors duration-150 ease-[0.25,1,0.5,1] hover:text-rose-700 dark:text-rose-300 dark:hover:text-rose-200"
              >
                <ChevronDown className="size-4 transition-transform duration-200 ease-in-out group-hover:translate-y-0.5" />
                <span className="text-xs font-medium">Scroll to bottom</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Jump to the latest message</TooltipContent>
          </Tooltip>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
