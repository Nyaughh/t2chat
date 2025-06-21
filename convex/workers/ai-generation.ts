import { internalAction, internalMutation, internalQuery } from '../_generated/server'
import { v } from 'convex/values'
import { Id } from '../_generated/dataModel'
import { generateAIResponse } from '../chat/shared'

// Background AI generation queue processor
export const processAIGenerationQueue = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log('[AIWorker] Processing AI generation queue')
    
    // Get pending AI generation tasks directly
    const pendingTasks = await getPendingTasksInternal(ctx)
    
    if (pendingTasks.length === 0) {
      return { processed: 0, message: 'No pending tasks' }
    }

    let processed = 0
    const errors: string[] = []

    for (const task of pendingTasks) {
      try {
        await processAITask(ctx, task)
        
        // Mark task as completed
        await markTaskCompletedInternal(ctx, task._id, Date.now())
        
        processed++
      } catch (error) {
        console.error('[AIWorker] Error processing task:', task._id, error)
        errors.push(`Task ${task._id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        
        // Mark task as failed
        await markTaskFailedInternal(ctx, task._id, error instanceof Error ? error.message : 'Unknown error', Date.now())
      }
    }

    return {
      processed,
      total: pendingTasks.length,
      errors: errors.length > 0 ? errors : undefined
    }
  }
})

// Internal helper functions
async function getPendingTasksInternal(ctx: any) {
  const now = Date.now()
  
  return await ctx.db
    .query('aiGenerationTasks')
    .filter((q: any) => 
      q.and(
        q.eq(q.field('status'), 'pending'),
        q.lte(q.field('scheduledFor'), now),
        q.lt(q.field('retryCount'), 3) // Max 3 retries
      )
    )
    .order('desc')
    .take(10) // Process up to 10 tasks at once
}

async function markTaskCompletedInternal(ctx: any, taskId: Id<'aiGenerationTasks'>, completedAt: number) {
  await ctx.db.patch(taskId, {
    status: 'completed',
    completedAt
  })
}

async function markTaskFailedInternal(ctx: any, taskId: Id<'aiGenerationTasks'>, error: string, failedAt: number) {
  const task = await ctx.db.get(taskId)
  if (!task) return
  
  const newRetryCount = (task.retryCount || 0) + 1
  const shouldRetry = newRetryCount < 3
  
  await ctx.db.patch(taskId, {
    status: shouldRetry ? 'pending' : 'failed',
    error,
    failedAt,
    retryCount: newRetryCount,
    // Retry with exponential backoff
    scheduledFor: shouldRetry ? Date.now() + (Math.pow(2, newRetryCount) * 60000) : undefined
  })
}

// Process individual AI task
async function processAITask(ctx: any, task: any) {
  const { type, payload } = task
  
  switch (type) {
    case 'generate_response':
      await handleGenerateResponse(ctx, payload)
      break
      
    case 'generate_title':
      await handleGenerateTitle(ctx, payload)
      break
      
    case 'process_thinking':
      await handleProcessThinking(ctx, payload)
      break
      
    case 'optimize_message':
      await handleOptimizeMessage(ctx, payload)
      break
      
    default:
      throw new Error(`Unknown task type: ${type}`)
  }
}

// Generate AI response in background
async function handleGenerateResponse(ctx: any, payload: {
  chatId: Id<'chats'>
  messageId: Id<'messages'>
  modelId: string
  chatMessages: any[]
  webSearch?: boolean
}) {
  const { chatId, messageId, modelId, chatMessages, webSearch } = payload
  
  try {
    // Generate the AI response
    await generateAIResponse(ctx, chatMessages, modelId, messageId, webSearch, true)
    
    // Update chat timestamp
    await ctx.db.patch(chatId, { updatedAt: Date.now() })
    
    console.log('[AIWorker] Generated response for message:', messageId)
  } catch (error) {
    // Update message with error
    await ctx.db.patch(messageId, {
      content: `I apologize, but I encountered an error: ${error instanceof Error ? error.message : 'AI generation failed'}`,
      isComplete: true,
      isCancelled: false
    })
    
    throw error
  }
}

// Generate chat title in background
async function handleGenerateTitle(ctx: any, payload: {
  chatId: Id<'chats'>
  firstMessage: string
}) {
  const { chatId, firstMessage } = payload
  
  try {
    // Use a simple model for title generation
    const titlePrompt = `Generate a concise, descriptive title (max 50 characters) for a conversation that starts with: "${firstMessage.slice(0, 200)}"`
    
    // This would typically use a lightweight model for title generation
    const title = await generateSimpleTitle(titlePrompt)
    
    // Update chat title
    await ctx.db.patch(chatId, { 
      title: title.slice(0, 50), // Ensure max length
      isGeneratingTitle: false 
    })
    
    console.log('[AIWorker] Generated title for chat:', chatId, ':', title)
  } catch (error) {
    // Mark title generation as failed
    await ctx.db.patch(chatId, { isGeneratingTitle: false })
    
    throw error
  }
}

// Process thinking content
async function handleProcessThinking(ctx: any, payload: {
  messageId: Id<'messages'>
  thinkingContent: string
}) {
  const { messageId, thinkingContent } = payload
  
  try {
    // Extract key insights from thinking
    const insights = extractThinkingInsights(thinkingContent)
    
    // Store processed thinking data
    await ctx.db.patch(messageId, {
      processedThinking: {
        insights,
        wordCount: thinkingContent.split(/\s+/).length,
        processedAt: Date.now()
      }
    })
    
    console.log('[AIWorker] Processed thinking for message:', messageId)
  } catch (error) {
    console.error('[AIWorker] Error processing thinking:', error)
    throw error
  }
}

// Optimize message content
async function handleOptimizeMessage(ctx: any, payload: {
  messageId: Id<'messages'>
  content: string
}) {
  const { messageId, content } = payload
  
  try {
    // Extract metadata and optimize content
    const metadata = {
      wordCount: content.split(/\s+/).length,
      charCount: content.length,
      codeBlocks: extractCodeBlocks(content),
      links: extractLinks(content),
      hasMarkdown: /[*_#`]/.test(content),
      language: detectContentLanguage(content)
    }
    
    // Store optimization data
    await ctx.db.patch(messageId, { metadata })
    
    console.log('[AIWorker] Optimized message:', messageId)
  } catch (error) {
    console.error('[AIWorker] Error optimizing message:', error)
    throw error
  }
}

// Queue a new AI generation task
export const queueAIGenerationTask = internalMutation({
  args: {
    type: v.string(),
    payload: v.any(),
    priority: v.optional(v.number()),
    scheduledFor: v.optional(v.number())
  },
  handler: async (ctx, { type, payload, priority = 5, scheduledFor }) => {
    const taskId = await ctx.db.insert('aiGenerationTasks', {
      type,
      payload,
      priority,
      status: 'pending',
      createdAt: Date.now(),
      scheduledFor: scheduledFor || Date.now(),
      retryCount: 0
    })
    
    console.log('[AIWorker] Queued task:', taskId, 'type:', type)
    return taskId
  }
})

// Get pending tasks
export const getPendingTasks = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    
    return await ctx.db
      .query('aiGenerationTasks')
      .filter((q) => 
        q.and(
          q.eq(q.field('status'), 'pending'),
          q.lte(q.field('scheduledFor'), now),
          q.lt(q.field('retryCount'), 3) // Max 3 retries
        )
      )
      .order('desc')
      .take(10) // Process up to 10 tasks at once
  }
})

// Cleanup old completed/failed tasks
export const cleanupOldTasks = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000) // 7 days ago
    
    const oldTasks = await ctx.db
      .query('aiGenerationTasks')
      .filter((q) => 
        q.and(
          q.or(
            q.eq(q.field('status'), 'completed'),
            q.eq(q.field('status'), 'failed')
          ),
          q.lt(q.field('createdAt'), cutoffTime)
        )
      )
      .collect()
    
    for (const task of oldTasks) {
      await ctx.db.delete(task._id)
    }
    
    console.log('[AIWorker] Cleaned up', oldTasks.length, 'old tasks')
    return { deleted: oldTasks.length }
  }
})

// Helper functions

async function generateSimpleTitle(prompt: string): Promise<string> {
  // Simple title generation - in a real implementation, this would call a lightweight AI model
  const words = prompt.split(' ').slice(0, 8)
  return words.join(' ').replace(/[^\w\s]/g, '').trim() || 'New Chat'
}

function extractThinkingInsights(thinking: string) {
  // Extract key insights from thinking content
  const insights: string[] = []
  
  // Look for reasoning patterns
  const reasoningPatterns = [
    /I need to (.*?)(?:\.|$)/gi,
    /The key insight is (.*?)(?:\.|$)/gi,
    /This suggests (.*?)(?:\.|$)/gi,
    /Therefore (.*?)(?:\.|$)/gi
  ]
  
  for (const pattern of reasoningPatterns) {
    const matches = thinking.match(pattern)
    if (matches) {
      insights.push(...matches.slice(0, 3)) // Max 3 per pattern
    }
  }
  
  return insights.slice(0, 10) // Max 10 insights total
}

function extractCodeBlocks(content: string) {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g
  const blocks: Array<{ language: string | null; code: string }> = []
  
  let match
  while ((match = codeBlockRegex.exec(content)) !== null) {
    blocks.push({
      language: match[1] || null,
      code: match[2].trim()
    })
  }
  
  return blocks
}

function extractLinks(content: string) {
  const linkRegex = /https?:\/\/[^\s)]+/g
  return content.match(linkRegex) || []
}

function detectContentLanguage(content: string): string {
  // Simple language detection based on content patterns
  if (/function|const|let|var|class/.test(content)) return 'javascript'
  if (/def |import |from |class/.test(content)) return 'python'
  if (/public|private|class|interface/.test(content)) return 'java'
  if (/#include|int main|std::/.test(content)) return 'cpp'
  return 'text'
} 