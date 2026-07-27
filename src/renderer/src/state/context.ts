import { createContext } from 'react'
import type {
  Conversation,
  ConversationMode,
  ConversationSummary,
  ToolExecutionRecord
} from '@shared/types'

export interface ChatState {
  conversations: ConversationSummary[]
  activeConversation: Conversation | null
  activeMode: ConversationMode
  streamingContent: string | null
  toolExecutions: ToolExecutionRecord[]
  activeRequestId: string | null
  error: string | null
}

export interface ChatContextValue extends ChatState {
  selectConversation: (id: string) => Promise<void>
  newConversation: (mode: ConversationMode) => Promise<void>
  selectTab: (mode: ConversationMode) => Promise<void>
  syncConversations: () => Promise<void>
  deleteConversationById: (id: string) => Promise<void>
  updateConversationSettings: (
    partial: Partial<Pick<Conversation, 'title' | 'model' | 'temperature' | 'systemPrompt'>>
  ) => Promise<void>
  sendMessage: (text: string) => void
  regenerateLastResponse: () => void
  stopStreaming: () => void
}

export const ChatContext = createContext<ChatContextValue | null>(null)
