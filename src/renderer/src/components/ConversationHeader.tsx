import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useChat } from '../state/useChat'

function ConversationHeader(): React.JSX.Element | null {
  const { t } = useTranslation()
  const { activeConversation, updateConversationSettings, deleteConversationById } = useChat()
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [systemPromptOpen, setSystemPromptOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function handleClickOutside(e: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  if (!activeConversation) return null

  function startRename(): void {
    setTitleDraft(activeConversation!.title)
    setRenaming(true)
    setMenuOpen(false)
  }

  function commitRename(): void {
    const trimmed = titleDraft.trim()
    if (trimmed && trimmed !== activeConversation!.title) {
      updateConversationSettings({ title: trimmed })
    }
    setRenaming(false)
  }

  return (
    <div className="conversation-header">
      <div className="conversation-header-row" ref={menuRef}>
        {renaming ? (
          <input
            className="conversation-title-input"
            value={titleDraft}
            autoFocus
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') setRenaming(false)
            }}
          />
        ) : (
          <button className="conversation-title-button" onClick={() => setMenuOpen((o) => !o)}>
            <span className="conversation-title-text">{activeConversation.title}</span>
            <span className="conversation-title-chevron">⌄</span>
          </button>
        )}

        {menuOpen && (
          <div className="conversation-menu">
            <button onClick={startRename}>{t('conversation.rename')}</button>
            <button
              onClick={() => {
                setSystemPromptOpen((o) => !o)
                setMenuOpen(false)
              }}
            >
              {t('conversation.systemPrompt')}
            </button>
            <button
              className="conversation-menu-danger"
              onClick={() => {
                setMenuOpen(false)
                deleteConversationById(activeConversation!.id)
              }}
            >
              {t('conversation.delete')}
            </button>
          </div>
        )}
      </div>

      {systemPromptOpen && (
        <textarea
          className="conversation-system-prompt"
          rows={3}
          placeholder={t('conversation.systemPromptPlaceholder')}
          value={activeConversation.systemPrompt}
          onChange={(e) => updateConversationSettings({ systemPrompt: e.target.value })}
        />
      )}
    </div>
  )
}

export default ConversationHeader
