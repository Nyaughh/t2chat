// Web Worker for message processing and indexing
// This runs in a separate thread to avoid blocking the UI

import { marked } from 'marked';

// Types for worker communication
interface ProcessMessageRequest {
  type: 'PROCESS_MESSAGE';
  payload: {
    id: string;
    content: string;
    role: 'user' | 'assistant';
    modelId?: string;
    attachments?: any[];
  };
}

interface IndexMessagesRequest {
  type: 'INDEX_MESSAGES';
  payload: {
    messages: Array<{
      id: string;
      content: string;
      role: 'user' | 'assistant';
      chatId: string;
      createdAt: number;
    }>;
  };
}

interface SearchRequest {
  type: 'SEARCH_MESSAGES';
  payload: {
    query: string;
    chatId?: string;
    limit?: number;
  };
}

interface ParseMarkdownRequest {
  type: 'PARSE_MARKDOWN';
  payload: {
    id: string;
    content: string;
  };
}

interface ExtractCodeBlocksRequest {
  type: 'EXTRACT_CODE_BLOCKS';
  payload: {
    id: string;
    content: string;
  };
}

type WorkerRequest = 
  | ProcessMessageRequest 
  | IndexMessagesRequest 
  | SearchRequest 
  | ParseMarkdownRequest
  | ExtractCodeBlocksRequest;

// In-memory search index
let searchIndex: Map<string, {
  id: string;
  content: string;
  role: string;
  chatId: string;
  createdAt: number;
  tokens: string[];
}> = new Map();

// Configure marked for better performance
marked.setOptions({
  gfm: true,
  breaks: true,
  pedantic: false,
});

// Listen for messages from main thread
self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const { type, payload } = event.data;

  try {
    switch (type) {
      case 'PROCESS_MESSAGE':
        await handleProcessMessage(payload);
        break;
        
      case 'INDEX_MESSAGES':
        await handleIndexMessages(payload);
        break;
        
      case 'SEARCH_MESSAGES':
        await handleSearchMessages(payload);
        break;
        
      case 'PARSE_MARKDOWN':
        await handleParseMarkdown(payload);
        break;
        
      case 'EXTRACT_CODE_BLOCKS':
        await handleExtractCodeBlocks(payload);
        break;
        
      default:
        console.warn('[MessageWorker] Unknown message type:', type);
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      payload: {
        error: error instanceof Error ? error.message : 'Unknown error',
        originalType: type
      }
    });
  }
});

// Process a single message
async function handleProcessMessage(payload: ProcessMessageRequest['payload']) {
  const { id, content, role, modelId, attachments } = payload;
  
  // Parse markdown if it's an assistant message
  let parsedContent = content;
  let codeBlocks: any[] = [];
  
  if (role === 'assistant') {
    parsedContent = await parseMarkdownContent(content);
    codeBlocks = extractCodeBlocks(content);
  }
  
  // Tokenize for search
  const tokens = tokenizeText(content);
  
  // Extract metadata
  const metadata = {
    wordCount: content.split(/\s+/).length,
    hasCode: codeBlocks.length > 0,
    hasAttachments: attachments && attachments.length > 0,
    languages: codeBlocks.map(block => block.language).filter(Boolean),
  };
  
  // Send processed result back
  self.postMessage({
    type: 'MESSAGE_PROCESSED',
    payload: {
      id,
      parsedContent,
      codeBlocks,
      tokens,
      metadata
    }
  });
}

// Index multiple messages for search
async function handleIndexMessages(payload: IndexMessagesRequest['payload']) {
  const { messages } = payload;
  let indexedCount = 0;
  
  for (const message of messages) {
    const tokens = tokenizeText(message.content);
    
    searchIndex.set(message.id, {
      id: message.id,
      content: message.content,
      role: message.role,
      chatId: message.chatId,
      createdAt: message.createdAt,
      tokens
    });
    
    indexedCount++;
    
    // Send progress updates for large batches
    if (indexedCount % 100 === 0) {
      self.postMessage({
        type: 'INDEX_PROGRESS',
        payload: {
          processed: indexedCount,
          total: messages.length
        }
      });
    }
  }
  
  self.postMessage({
    type: 'INDEX_COMPLETE',
    payload: {
      totalIndexed: indexedCount,
      indexSize: searchIndex.size
    }
  });
}

// Search through indexed messages
async function handleSearchMessages(payload: SearchRequest['payload']) {
  const { query, chatId, limit = 50 } = payload;
  const queryTokens = tokenizeText(query.toLowerCase());
  
  const results: Array<{
    id: string;
    content: string;
    role: string;
    chatId: string;
    createdAt: number;
    score: number;
    matches: string[];
  }> = [];
  
  for (const [id, doc] of searchIndex) {
    // Filter by chat if specified
    if (chatId && doc.chatId !== chatId) continue;
    
    // Calculate relevance score
    const score = calculateRelevanceScore(queryTokens, doc.tokens, doc.content);
    
    if (score > 0) {
      const matches = findMatches(queryTokens, doc.content);
      results.push({
        id: doc.id,
        content: doc.content,
        role: doc.role,
        chatId: doc.chatId,
        createdAt: doc.createdAt,
        score,
        matches
      });
    }
  }
  
  // Sort by relevance score and limit results
  results.sort((a, b) => b.score - a.score);
  const limitedResults = results.slice(0, limit);
  
  self.postMessage({
    type: 'SEARCH_RESULTS',
    payload: {
      query,
      results: limitedResults,
      totalFound: results.length
    }
  });
}

// Parse markdown content
async function handleParseMarkdown(payload: ParseMarkdownRequest['payload']) {
  const { id, content } = payload;
  
  try {
    const parsed = await parseMarkdownContent(content);
    
    self.postMessage({
      type: 'MARKDOWN_PARSED',
      payload: {
        id,
        parsed
      }
    });
  } catch (error) {
    self.postMessage({
      type: 'MARKDOWN_ERROR',
      payload: {
        id,
        error: error instanceof Error ? error.message : 'Parsing failed'
      }
    });
  }
}

// Extract code blocks from content
async function handleExtractCodeBlocks(payload: ExtractCodeBlocksRequest['payload']) {
  const { id, content } = payload;
  
  const codeBlocks = extractCodeBlocks(content);
  
  self.postMessage({
    type: 'CODE_BLOCKS_EXTRACTED',
    payload: {
      id,
      codeBlocks
    }
  });
}

// Helper functions

async function parseMarkdownContent(content: string): Promise<string> {
  try {
    return await marked(content);
  } catch (error) {
    console.error('[MessageWorker] Markdown parsing error:', error);
    return content; // Fallback to original content
  }
}

function extractCodeBlocks(content: string) {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const blocks: Array<{
    language: string | null;
    code: string;
    startIndex: number;
    endIndex: number;
  }> = [];
  
  let match;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    blocks.push({
      language: match[1] || null,
      code: match[2].trim(),
      startIndex: match.index,
      endIndex: match.index + match[0].length
    });
  }
  
  return blocks;
}

function tokenizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2)
    .filter(token => !isStopWord(token));
}

function isStopWord(word: string): boolean {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'
  ]);
  
  return stopWords.has(word);
}

function calculateRelevanceScore(queryTokens: string[], docTokens: string[], content: string): number {
  let score = 0;
  const contentLower = content.toLowerCase();
  
  for (const queryToken of queryTokens) {
    // Exact matches get higher score
    const exactMatches = (contentLower.match(new RegExp(queryToken, 'g')) || []).length;
    score += exactMatches * 2;
    
    // Token matches get lower score
    const tokenMatches = docTokens.filter(token => token.includes(queryToken)).length;
    score += tokenMatches;
    
    // Prefix matches
    const prefixMatches = docTokens.filter(token => token.startsWith(queryToken)).length;
    score += prefixMatches * 1.5;
  }
  
  return score;
}

function findMatches(queryTokens: string[], content: string): string[] {
  const matches: string[] = [];
  const contentLower = content.toLowerCase();
  
  for (const queryToken of queryTokens) {
    const regex = new RegExp(`\\b\\w*${queryToken}\\w*\\b`, 'gi');
    const tokenMatches = contentLower.match(regex) || [];
    matches.push(...tokenMatches);
  }
  
  return [...new Set(matches)]; // Remove duplicates
}

// Worker initialization
self.postMessage({
  type: 'WORKER_READY',
  payload: {
    message: 'Message processor worker initialized'
  }
});

// Export types for TypeScript support (won't be included in worker bundle)
export type {
  ProcessMessageRequest,
  IndexMessagesRequest,
  SearchRequest,
  ParseMarkdownRequest,
  ExtractCodeBlocksRequest,
  WorkerRequest
}; 