import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useChat } from '../state/ChatContext'
import mistralIconWhite from '../assets/mistral-icon-white.svg'

interface Props {
  onOpenSettings: () => void
}

function Sidebar({ onOpenSettings }: Props): React.JSX.Element {
  const { t } = useTranslation()
  const {
    conversations,
    activeConversation,
    activeMode,
    selectConversation,
    newConversation,
    selectTab,
    syncConversations,
    deleteConversationById
  } = useChat()
  const [syncing, setSyncing] = useState(false)

  const visibleConversations = conversations.filter((c) => c.mode === activeMode)

  async function handleSync(): Promise<void> {
    if (syncing) return
    setSyncing(true)
    try {
      await syncConversations()
    } finally {
      setSyncing(false)
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-titlebar-spacer" />
      <div className="sidebar-brand">
        <div className="sidebar-brand-badge">
          <img src={mistralIconWhite} alt="" />
        </div>
        <span className="sidebar-brand-name">{t('app.title')}</span>
        <button
          className={
            syncing ? 'sidebar-sync-button sidebar-sync-button-spinning' : 'sidebar-sync-button'
          }
          onClick={handleSync}
          disabled={syncing}
          aria-label={t('sidebar.sync')}
          title={t('sidebar.sync')}
        >
          ↻
        </button>
      </div>

      <div className="sidebar-tabs">
        <button
          className={activeMode === 'chat' ? 'sidebar-tab sidebar-tab-active' : 'sidebar-tab'}
          onClick={() => selectTab('chat')}
        >
          {t('sidebar.chatTab')}
        </button>
        <button
          className={activeMode === 'code' ? 'sidebar-tab sidebar-tab-active' : 'sidebar-tab'}
          onClick={() => selectTab('code')}
        >
          {t('sidebar.codeTab')}
        </button>
      </div>

      <button className="new-chat-button" onClick={() => newConversation(activeMode)}>
        <span className="new-chat-icon">+</span>
        <span>{activeMode === 'code' ? t('sidebar.newCode') : t('sidebar.newChat')}</span>
      </button>
      <ul className="conversation-list">
        {visibleConversations.map((conversation) => (
          <li
            key={conversation.id}
            className={
              conversation.id === activeConversation?.id
                ? 'conversation-item conversation-item-active'
                : 'conversation-item'
            }
          >
            <button
              className="conversation-title"
              onClick={() => selectConversation(conversation.id)}
            >
              {conversation.title}
            </button>
            <button
              className="conversation-delete"
              aria-label={t('sidebar.deleteConversation')}
              onClick={(e) => {
                e.stopPropagation()
                deleteConversationById(conversation.id)
              }}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <button className="sidebar-footer" onClick={onOpenSettings}>
        <span className="sidebar-footer-icon">⚙</span>
        <span className="sidebar-footer-label">{t('settings.title')}</span>
      </button>
    </aside>
  )
}

export default Sidebar
