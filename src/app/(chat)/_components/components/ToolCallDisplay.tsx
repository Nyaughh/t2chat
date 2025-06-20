import React, { useState } from 'react'
import {
  Loader2,
  Search,
  Link as LinkIcon,
  ChevronDown,
  Image as ImageIcon,
  Download,
  ExternalLink,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

const ToolCallDisplay = ({ toolCalls }: { toolCalls: any[] }) => {
  const [isCollapsed, setIsCollapsed] = useState(true)

  if (!toolCalls || toolCalls.length === 0) {
    return null
  }

  const hasResults = toolCalls.some((call) => call.result && call.result.results && call.result.results.length > 0)

  return (
    <div className="mt-4 space-y-4">
      {toolCalls.map((call) => (
        <div
          key={call.toolCallId}
          className={cn(
            call.toolName !== 'generateImage' && 'p-3 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10'
          )}
        >
          {call.toolName === 'search' && (
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-black/60 dark:text-white/60 mb-2">
                  {call.result ? <Search className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>
                    {call.result ? 'Searched the web for:' : 'Searching the web for:'} <em>"{call.args.query}"</em>
                  </span>
                </div>
                {hasResults && (
                  <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="flex items-center gap-1 text-xs text-black/50 dark:text-white/50 hover:text-black/80 dark:hover:text-white/80"
                  >
                    <span>{isCollapsed ? 'Show' : 'Hide'} Results</span>
                    <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', !isCollapsed && 'rotate-180')} />
                  </button>
                )}
              </div>

              <AnimatePresence>
                {!isCollapsed && call.result && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-3 overflow-hidden"
                  >
                    {call.result.answer && (
                      <div className="text-sm p-3 mt-2 rounded-md bg-black/5 dark:bg-white/5">
                        <strong>Answer:</strong> {call.result.answer}
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {call.result.results.map((item: any, index: number) => (
                        <a
                          key={index}
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-3 rounded-lg bg-white dark:bg-black/20 hover:bg-gray-50 dark:hover:bg-black/30 transition-colors shadow-sm border border-black/5 dark:border-white/5"
                        >
                          <div className="font-semibold text-sm text-rose-600 dark:text-rose-400 truncate">
                            {item.title}
                          </div>
                          <p className="text-xs text-black/70 dark:text-white/70 mt-1 line-clamp-2">{item.content}</p>
                          <div className="flex items-center gap-1.5 mt-2">
                            <LinkIcon className="w-3 h-3 text-black/40 dark:text-white/40" />
                            <span className="text-xs text-black/50 dark:text-white/50 truncate">{item.url}</span>
                          </div>
                        </a>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {call.toolName === 'generateImage' && (
            <>
              {/* Success: Display image only */}
              {call.result && call.result.success && call.result.imageUrl && (
                <div className="relative group w-fit">
                  <img
                    src={call.result.imageUrl}
                    alt={call.args.prompt}
                    className="w-auto h-auto max-h-96 max-w-full object-contain rounded-lg"
                  />

                  {/* Action buttons overlay */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button
                      onClick={() => {
                        const link = document.createElement('a')
                        link.href = call.result.imageUrl
                        link.download = `generated-image-${Date.now()}.png`
                        link.click()
                      }}
                      className="p-1.5 rounded bg-black/70 hover:bg-black/80 transition-colors"
                      title="Download image"
                    >
                      <Download className="w-3.5 h-3.5 text-white" />
                    </button>
                    <button
                      onClick={() => {
                        window.open(call.result.imageUrl, '_blank')
                      }}
                      className="p-1.5 rounded bg-black/70 hover:bg-black/80 transition-colors"
                      title="Open in new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-white" />
                    </button>
                  </div>
                </div>
              )}

              {/* Error state - minimal */}
              {call.result && !call.result.success && (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200/50 dark:border-red-800/50">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500 mt-2 flex-shrink-0"></div>
                    <div>
                      <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">
                        Failed to generate image
                      </p>
                      <p className="text-sm text-red-600 dark:text-red-400">{call.result.error}</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  )
}

export default ToolCallDisplay
