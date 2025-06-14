'use client'

import { ChevronDown } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

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
          className="fixed bottom-24 md:bottom-28 left-1/2 -translate-x-1/2 z-30"
        >
          <button
            onClick={onScrollToBottom}
            className="group p-2 rounded-full bg-white/80 dark:bg-black/60 backdrop-blur-lg shadow-lg dark:shadow-2xl ring-1 ring-black/5 dark:ring-white/10 hover:scale-110 transition-transform duration-150 ease-[0.25,1,0.5,1]"
            title="Scroll to bottom"
          >
            <ChevronDown className="w-5 h-5 text-black/60 dark:text-white/60" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
} 