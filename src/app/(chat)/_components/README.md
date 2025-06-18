# Chat Components Refactoring

This directory contains the refactored chat interface components, split into multiple hooks and components for better maintainability.

## Structure

### Hooks (`/hooks`)

Custom hooks that encapsulate business logic and state management:

- **`useChatInterface.ts`** - Main chat interface logic, orchestrates all other hooks
- **`useMessageActions.ts`** - Message-related actions (copy, edit, retry, model utilities)
- **`useScrollToBottom.ts`** - Scroll management and auto-scroll behavior
- **`useFileUpload.ts`** - File upload handling and attachment management
- **`useChatLayout.ts`** - Main layout logic, orchestrates layout-related hooks
- **`useChatSearch.ts`** - Chat search functionality and filtering
- **`useChatGroups.ts`** - Chat grouping logic (Today, Yesterday, etc.)

### Components (`/components`)

Reusable UI components:

#### Chat Interface Components

- **`MessageList.tsx`** - Container for all messages with scroll area
- **`MessageItem.tsx`** - Individual message component (user/assistant)
- **`MessageActions.tsx`** - Action buttons for messages (copy, retry, model display)
- **`EditMessageForm.tsx`** - Inline message editing form
- **`ScrollToBottomButton.tsx`** - Floating scroll-to-bottom button

#### Chat Layout Components

- **`Sidebar.tsx`** - Main sidebar container
- **`ChatList.tsx`** - Container for grouped chat conversations
- **`ChatGroup.tsx`** - Group of chats (e.g., "Today", "Yesterday")
- **`ChatItem.tsx`** - Individual chat item with hover effects
- **`UserProfile.tsx`** - User profile section at bottom of sidebar
- **`TopControls.tsx`** - Top control buttons (settings, theme, menu, new chat)

## Benefits of This Structure

1. **Separation of Concerns**: Business logic is separated from UI components
2. **Reusability**: Components can be easily reused in different contexts
3. **Testability**: Hooks and components can be tested independently
4. **Maintainability**: Smaller, focused files are easier to understand and modify
5. **Type Safety**: Each component has well-defined TypeScript interfaces
6. **Performance**: Components can be optimized individually

## Usage

```tsx
// Import the main components
import ChatInterface from './_components/ChatInterface'
import ChatLayout from './_components/ChatLayout'

// Or import specific hooks/components
import { useChatInterface } from './_components/hooks'
import { MessageList, Sidebar } from './_components/components'
```

## Migration Notes

- All functionality from the original monolithic files has been preserved
- Component interfaces are designed to be backward compatible
- The main `ChatInterface.tsx` and `ChatLayout.tsx` files now act as orchestrators
- No breaking changes to the external API
