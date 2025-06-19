'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useMemo, useState, useEffect } from 'react'

interface WelcomeScreenProps {
  onPromptClick: (prompt: string) => void
}

const allPrompts = [
  // General AI & Technology
  'How does AI work?',
  'Explain machine learning in simple terms',
  'What are the benefits and risks of AI?',
  'How does ChatGPT generate responses?',
  'What is the difference between AI and automation?',

  // Science & Space
  'Are black holes real?',
  'How do stars form?',
  'What would happen if you fell into a black hole?',
  'Explain quantum physics simply',
  'How big is the universe?',
  'What causes the northern lights?',

  // Language & Logic
  'How many Rs are in the word "strawberry"?',
  'What are some common grammar mistakes?',
  'Explain the difference between "its" and "it\'s"',
  'What makes a good password?',
  "How do you solve a Rubik's cube?",

  // Philosophy & Life
  'What is the meaning of life?',
  'What makes people happy?',
  'How do you overcome procrastination?',
  'What is consciousness?',
  'How do you build good habits?',

  // Practical & Creative
  'Write a short story about time travel',
  'How do you make a perfect cup of coffee?',
  'What are some healthy meal prep ideas?',
  'Help me plan a weekend trip',
  'How do you learn a new language effectively?',
  'What are some creative writing prompts?',

  // Technology & Programming
  'Explain APIs in simple terms',
  'What is cloud computing?',
  'How does the internet work?',
  'What programming language should I learn first?',
  'How do you stay safe online?',

  // Business & Career
  'How do you write a good resume?',
  'What makes a great leader?',
  'How do you negotiate salary?',
  'What are some good interview questions to ask?',
  'How do you manage your time effectively?',
]

function PromptItem({ prompt, onClick }: { prompt: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'group p-3 md:p-4 cursor-pointer transition-all duration-150 ease-[0.25,1,0.5,1] relative overflow-hidden',
        'hover:text-rose-600 dark:hover:text-rose-300 text-black/70 dark:text-white/70',
        'rounded-lg',
      )}
    >
      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-[0.25,1,0.5,1]">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-rose-500/8 dark:via-rose-300/8 to-transparent"></div>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rose-500/30 dark:via-rose-300/30 to-transparent"></div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-rose-500/30 dark:via-rose-300/30 to-transparent"></div>
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-4 bg-gradient-to-r from-transparent via-rose-500/5 dark:via-rose-300/5 to-transparent blur-sm"></div>
      </div>
      <div className="relative z-10 text-sm md:text-base truncate">{prompt}</div>
    </div>
  )
}

export default function WelcomeScreen({ onPromptClick }: WelcomeScreenProps) {
  // Use static prompts for SSR, then randomize on client
  const [randomPrompts, setRandomPrompts] = useState(() => {
    // Static prompts for initial render (SSR)
    return allPrompts.slice(0, 4)
  })

  // Randomize prompts only on client-side after hydration
  useEffect(() => {
    const shuffled = [...allPrompts].sort(() => 0.5 - Math.random())
    setRandomPrompts(shuffled.slice(0, 4))
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{
        opacity: 0,
        y: -20,
        scale: 0.9,
        transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] },
      }}
      transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
      className="absolute inset-0 flex flex-col items-center justify-center p-6 pb-24"
    >
      <div className="max-w-md w-full text-left">
        <div className="mt-8">
          <div className="px-3 mb-4">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2 whitespace-nowrap">
              How can I help you?
            </h1>
            <h3 className="text-xs font-medium text-black/50 dark:text-white/50 uppercase tracking-wider">
              Here are some prompts to help you get started.
            </h3>
          </div>
          <div className="divide-y divide-rose-500/10 dark:divide-rose-300/10">
            {randomPrompts.map((prompt, i) => (
              <PromptItem key={`${prompt}-${i}`} prompt={prompt} onClick={() => onPromptClick(prompt)} />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
