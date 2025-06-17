import React, { useState } from 'react';
import { Loader2, Search, Link as LinkIcon, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const ToolCallDisplay = ({ toolCalls }: { toolCalls: any[] }) => {
  const [isCollapsed, setIsCollapsed] = useState(true);

  if (!toolCalls || toolCalls.length === 0) {
    return null;
  }

  const hasResults = toolCalls.some(call => call.result && call.result.results && call.result.results.length > 0);

  return (
    <div className="mt-4 space-y-4">
      {toolCalls.map((call) => (
        <div key={call.toolCallId} className="p-3 rounded-lg bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
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
                   <button onClick={() => setIsCollapsed(!isCollapsed)} className="flex items-center gap-1 text-xs text-black/50 dark:text-white/50 hover:text-black/80 dark:hover:text-white/80">
                     <span>{isCollapsed ? 'Show' : 'Hide'} Results</span>
                     <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", !isCollapsed && "rotate-180")} />
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
                          <div className="font-semibold text-sm text-rose-600 dark:text-rose-400 truncate">{item.title}</div>
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
        </div>
      ))}
    </div>
  );
};

export default ToolCallDisplay; 