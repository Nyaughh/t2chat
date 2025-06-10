"use client";

import { motion } from 'framer-motion';

interface WelcomeScreenProps {
  onPromptClick: (prompt: string) => void;
}

const prompts = [
  "How does AI work?",
  "Are black holes real?",
  'How many Rs are in the word "strawberry"?',
  "What is the meaning of life?",
];

export default function WelcomeScreen({ onPromptClick }: WelcomeScreenProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ 
        opacity: 0, 
        y: -30, 
        scale: 0.9,
        transition: { duration: 0.4, ease: "easeInOut" }
      }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pb-24"
    >
      <div className="max-w-md">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">
          How can I help you?
        </h1>
        <p className="mt-4 text-base md:text-lg text-muted-foreground">
          Here are some prompts to help you get started.
        </p>
        
        <div className="mt-8 space-y-3 text-left">
          {prompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => onPromptClick(prompt)}
              className="w-full text-left p-3 md:p-4 rounded-lg bg-secondary/50 hover:bg-accent transition-colors duration-200 border border-border/50 hover:border-border"
            >
              <span className="text-foreground text-sm md:text-base">{prompt}</span>
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
} 