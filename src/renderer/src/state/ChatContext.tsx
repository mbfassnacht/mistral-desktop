import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type ReactNode,
  type JSX
} from 'react'
import type { Conversation, ConversationMode, ConversationSummary, ToolExecutionRecord } from '@shared/types'

interface ChatState {
  conversations: ConversationSummary[]
  activeConversation: Conversation | null
  activeMode: ConversationMode
  streamingContent: string | null
  toolExecutions: ToolExecutionRecord[]
  activeRequestId: string | null
  error: string | null
}

type Action =
  | { type: 'conversations/loaded'; conversations: ConversationSummary[] }
  | { type: 'conversation/loaded'; conversation: Conversation }
  | { type: 'conversation/updated'; conversation: Conversation }
  | { type: 'conversation/deleted'; id: string }
  | { type: 'message/user-appended'; conversationId: string; content: string }
  | { type: 'message/regenerate-started'; conversationId: string }
  | { type: 'stream/started'; requestId: string }
  | { type: 'stream/token'; requestId: string; delta: string }
  | { type: 'stream/tool'; requestId: string; execution: ToolExecutionRecord }
  | { type: 'stream/done'; requestId: string; content: string }
  | { type: 'stream/error'; requestId: string; message: string }
  | { type: 'stream/cancelled' }

const initialState: ChatState = {
  conversations: [],
  activeConversation: null,
  activeMode: 'chat',
  streamingContent: null,
  toolExecutions: [],
  activeRequestId: null,
  error: null
}

function toSummary(conversation: Conversation): ConversationSummary {
  const { id, title, model, mode, createdAt, updatedAt } = conversation
  return { id, title, model, mode, createdAt, updatedAt }
}

function reducer(state: ChatState, action: Action): ChatState {
  switch (action.type) {
    case 'conversations/loaded': {
      // The title auto-generates from the first message on the main-process
      // side and is persisted immediately, but activeConversation is only
      // otherwise updated by loading/streaming actions - keep its title in
      // sync whenever a fresh conversation list comes in, so the header
      // doesn't keep showing "New Chat" after the real title lands.
      if (!state.activeConversation) return { ...state, conversations: action.conversations }
      const match = action.conversations.find((c) => c.id === state.activeConversation!.id)
      if (!match || match.title === state.activeConversation.title) {
        return { ...state, conversations: action.conversations }
      }
      return {
        ...state,
        conversations: action.conversations,
        activeConversation: { ...state.activeConversation, title: match.title }
      }
    }

    case 'conversation/loaded':
      return {
        ...state,
        activeConversation: action.conversation,
        activeMode: action.conversation.mode,
        streamingContent: null,
        toolExecutions: [],
        activeRequestId: null,
        error: null
      }

    case 'conversation/updated': {
      if (state.activeConversation?.id !== action.conversation.id) return state
      return {
        ...state,
        activeConversation: action.conversation,
        conversations: state.conversations.map((c) =>
          c.id === action.conversation.id ? toSummary(action.conversation) : c
        )
      }
    }

    case 'conversation/deleted':
      return {
        ...state,
        conversations: state.conversations.filter((c) => c.id !== action.id),
        activeConversation:
          state.activeConversation?.id === action.id ? null : state.activeConversation
      }

    case 'message/user-appended': {
      if (state.activeConversation?.id !== action.conversationId) return state
      return {
        ...state,
        activeConversation: {
          ...state.activeConversation,
          messages: [
            ...state.activeConversation.messages,
            { role: 'user', content: action.content, createdAt: Date.now() }
          ]
        },
        error: null
      }
    }

    case 'message/regenerate-started': {
      if (state.activeConversation?.id !== action.conversationId) return state
      const messages = state.activeConversation.messages
      const last = messages[messages.length - 1]
      return {
        ...state,
        activeConversation: {
          ...state.activeConversation,
          messages: last?.role === 'assistant' ? messages.slice(0, -1) : messages
        },
        error: null
      }
    }

    case 'stream/started':
      return {
        ...state,
        activeRequestId: action.requestId,
        streamingContent: '',
        toolExecutions: []
      }

    case 'stream/token':
      if (action.requestId !== state.activeRequestId) return state
      return { ...state, streamingContent: (state.streamingContent ?? '') + action.delta }

    case 'stream/tool': {
      if (action.requestId !== state.activeRequestId) return state
      const idx = state.toolExecutions.findIndex((t) => t.id === action.execution.id)
      const toolExecutions =
        idx === -1
          ? [...state.toolExecutions, action.execution]
          : state.toolExecutions.map((t, i) => (i === idx ? action.execution : t))
      return { ...state, toolExecutions }
    }

    case 'stream/done': {
      if (action.requestId !== state.activeRequestId || !state.activeConversation) return state
      return {
        ...state,
        activeConversation: {
          ...state.activeConversation,
          messages: [
            ...state.activeConversation.messages,
            {
              role: 'assistant',
              content: action.content,
              toolExecutions: state.toolExecutions.length > 0 ? state.toolExecutions : undefined,
              createdAt: Date.now()
            }
          ]
        },
        streamingContent: null,
        toolExecutions: [],
        activeRequestId: null
      }
    }

    case 'stream/error':
      if (action.requestId !== state.activeRequestId) return state
      return {
        ...state,
        streamingContent: null,
        toolExecutions: [],
        activeRequestId: null,
        error: action.message
      }

    case 'stream/cancelled':
      return { ...state, streamingContent: null, toolExecutions: [], activeRequestId: null }

    default:
      return state
  }
}

interface ChatContextValue extends ChatState {
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

const ChatContext = createContext<ChatContextValue | null>(null)

export function ChatProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, dispatch] = useReducer(reducer, initialState)
  const initStarted = useRef(false)

  useEffect(() => {
    const offToken = window.api.chat.onToken(({ requestId, delta }) =>
      dispatch({ type: 'stream/token', requestId, delta })
    )
    const offTool = window.api.chat.onTool(({ requestId, execution }) =>
      dispatch({ type: 'stream/tool', requestId, execution })
    )
    const offDone = window.api.chat.onDone(({ requestId, content }) => {
      dispatch({ type: 'stream/done', requestId, content })
      window.api.conversations
        .list()
        .then((conversations) => dispatch({ type: 'conversations/loaded', conversations }))
    })
    const offError = window.api.chat.onError(({ requestId, message }) => {
      dispatch({ type: 'stream/error', requestId, message })
      // The title (and, for a first message, the user message itself) is
      // persisted before the model call, even if that call then fails - keep
      // the sidebar/header showing what's actually on disk.
      window.api.conversations
        .list()
        .then((conversations) => dispatch({ type: 'conversations/loaded', conversations }))
    })

    // StrictMode double-invokes effects in dev; without this guard two
    // concurrent init() calls could both see an empty conversation list
    // and each create a "New Chat".
    if (!initStarted.current) {
      initStarted.current = true
      init()
    }

    return () => {
      offToken()
      offTool()
      offDone()
      offError()
    }
  }, [])

  async function init(): Promise<void> {
    // sync() opportunistically pulls in Code-mode conversations started on
    // other devices under the same API key before returning the list, so
    // they show up without the user having to do anything.
    let conversations = await window.api.conversations.sync()
    if (conversations.length === 0) {
      await window.api.conversations.create('chat')
      conversations = await window.api.conversations.list()
    }
    dispatch({ type: 'conversations/loaded', conversations })
    if (conversations[0]) {
      const conversation = await window.api.conversations.get(conversations[0].id)
      dispatch({ type: 'conversation/loaded', conversation })
    }
  }

  async function selectConversation(id: string): Promise<void> {
    const conversation = await window.api.conversations.get(id)
    dispatch({ type: 'conversation/loaded', conversation })
  }

  async function newConversation(mode: ConversationMode): Promise<void> {
    const conversation = await window.api.conversations.create(mode)
    const conversations = await window.api.conversations.list()
    dispatch({ type: 'conversations/loaded', conversations })
    dispatch({ type: 'conversation/loaded', conversation })
  }

  // Switches the Chat/Code tab. If the tab already has a conversation, the
  // most recent one is selected; otherwise a fresh one is created so the
  // user always lands on something they can type into, rather than an empty
  // "no conversation" screen.
  async function selectTab(mode: ConversationMode): Promise<void> {
    const existing = state.conversations.find((c) => c.mode === mode)
    if (existing) {
      await selectConversation(existing.id)
    } else {
      await newConversation(mode)
    }
  }

  async function syncConversations(): Promise<void> {
    const conversations = await window.api.conversations.sync()
    dispatch({ type: 'conversations/loaded', conversations })
  }

  async function deleteConversationById(id: string): Promise<void> {
    const wasActive = state.activeConversation?.id === id
    const mode = state.activeConversation?.mode ?? 'chat'
    await window.api.conversations.delete(id)
    dispatch({ type: 'conversation/deleted', id })
    let conversations = await window.api.conversations.list()
    if (conversations.length === 0) {
      // Never leave the user with no conversation to type into.
      await window.api.conversations.create(mode)
      conversations = await window.api.conversations.list()
    }
    dispatch({ type: 'conversations/loaded', conversations })
    if (wasActive) {
      const next = conversations.find((c) => c.mode === mode) ?? conversations[0]
      if (next) {
        const conversation = await window.api.conversations.get(next.id)
        dispatch({ type: 'conversation/loaded', conversation })
      }
    }
  }

  async function updateConversationSettings(
    partial: Partial<Pick<Conversation, 'title' | 'model' | 'temperature' | 'systemPrompt'>>
  ): Promise<void> {
    if (!state.activeConversation) return
    const conversation = await window.api.conversations.update(
      state.activeConversation.id,
      partial
    )
    dispatch({ type: 'conversation/updated', conversation })
  }

  function sendMessage(text: string): void {
    if (!state.activeConversation) return
    const conversationId = state.activeConversation.id
    dispatch({ type: 'message/user-appended', conversationId, content: text })
    const requestId = crypto.randomUUID()
    dispatch({ type: 'stream/started', requestId })
    window.api.chat.send({ requestId, conversationId, userMessage: text })
  }

  function regenerateLastResponse(): void {
    if (!state.activeConversation) return
    const messages = state.activeConversation.messages
    if (messages[messages.length - 1]?.role !== 'assistant') return
    const conversationId = state.activeConversation.id
    dispatch({ type: 'message/regenerate-started', conversationId })
    const requestId = crypto.randomUUID()
    dispatch({ type: 'stream/started', requestId })
    window.api.chat.send({ requestId, conversationId, userMessage: '', regenerate: true })
  }

  function stopStreaming(): void {
    if (state.activeRequestId) {
      window.api.chat.cancel(state.activeRequestId)
      dispatch({ type: 'stream/cancelled' })
    }
  }

  return (
    <ChatContext.Provider
      value={{
        ...state,
        selectConversation,
        newConversation,
        selectTab,
        syncConversations,
        deleteConversationById,
        updateConversationSettings,
        sendMessage,
        regenerateLastResponse,
        stopStreaming
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used within a ChatProvider')
  return ctx
}
