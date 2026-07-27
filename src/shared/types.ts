export type Role = 'system' | 'user' | 'assistant'

export type ConversationMode = 'chat' | 'code'

export interface ToolExecutionRecord {
  id: string
  name: string
  arguments: string
  status: 'running' | 'done'
  info?: unknown
}

export interface Message {
  role: Role
  content: string
  toolExecutions?: ToolExecutionRecord[]
  createdAt?: number
}

export interface ConversationSummary {
  id: string
  title: string
  model: string
  mode: ConversationMode
  createdAt: number
  updatedAt: number
}

export interface Conversation extends ConversationSummary {
  temperature: number
  systemPrompt: string
  messages: Message[]
  /** Mistral's own conversation id (code mode only), used to continue via appendStream. */
  remoteConversationId?: string
}

export interface Settings {
  defaultModel: string
  defaultTemperature: number
  defaultSystemPrompt: string
}

export type ApiKeyStatus = 'unset' | 'set' | 'unavailable'

export interface ChatSendPayload {
  requestId: string
  conversationId: string
  userMessage: string
  /** Re-run the turn using the existing history instead of appending a new user message. */
  regenerate?: boolean
}

export interface ChatTokenEvent {
  requestId: string
  delta: string
}

export interface ChatToolEvent {
  requestId: string
  execution: ToolExecutionRecord
}

export interface ChatDoneEvent {
  requestId: string
  content: string
}

export interface ChatErrorEvent {
  requestId: string
  message: string
}
