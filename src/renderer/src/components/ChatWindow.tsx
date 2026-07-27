import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Message } from '@shared/types'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import ConversationHeader from './ConversationHeader'
import { useChat } from '../state/useChat'
import { greetingKey } from '../greeting'
import mistralIcon from '../assets/mistral-icon-gradient.svg'

function ChatWindow(): React.JSX.Element {
  const { t } = useTranslation()
  const {
    activeConversation,
    streamingContent,
    toolExecutions,
    error,
    sendMessage,
    regenerateLastResponse,
    stopStreaming,
    updateConversationSettings
  } = useChat()
  const [greeting] = useState(() => greetingKey())

  if (!activeConversation) {
    return (
      <div className="chat-window">
        <p className="placeholder-text">{t('chat.loading')}</p>
      </div>
    )
  }

  const streaming = streamingContent !== null
  const isEmpty = activeConversation.messages.length === 0 && !streaming
  const model = activeConversation.model
  const onModelChange = (nextModel: string): void => {
    updateConversationSettings({ model: nextModel })
  }

  if (isEmpty) {
    return (
      <div className="chat-window">
        <ConversationHeader />
        <div className="empty-state">
          <img className="empty-state-icon" src={mistralIcon} alt="" />
          <h2 className="empty-state-greeting">{t(greeting)}</h2>
          <div className="empty-state-input">
            <MessageInput
              disabled={false}
              streaming={false}
              model={model}
              onModelChange={onModelChange}
              onSend={sendMessage}
              onStop={stopStreaming}
            />
          </div>
          {error && <p className="chat-error-banner">{error}</p>}
        </div>
      </div>
    )
  }

  const displayMessages: Message[] = streaming
    ? [
        ...activeConversation.messages,
        {
          role: 'assistant',
          content: streamingContent,
          toolExecutions: toolExecutions.length > 0 ? toolExecutions : undefined
        }
      ]
    : activeConversation.messages

  return (
    <div className="chat-window">
      <ConversationHeader />
      <MessageList
        messages={displayMessages}
        onRegenerate={regenerateLastResponse}
        regenerateEnabled={!streaming && activeConversation.mode === 'chat'}
      />
      {error && <p className="chat-error-banner">{error}</p>}
      <MessageInput
        disabled={streaming}
        streaming={streaming}
        model={model}
        onModelChange={onModelChange}
        onSend={sendMessage}
        onStop={stopStreaming}
      />
    </div>
  )
}

export default ChatWindow
