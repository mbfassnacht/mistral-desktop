import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MODEL_OPTIONS } from '../models'

interface Props {
  disabled: boolean
  streaming: boolean
  model: string
  onModelChange: (model: string) => void
  onSend: (text: string) => void
  onStop: () => void
}

function MessageInput({
  disabled,
  streaming,
  model,
  onModelChange,
  onSend,
  onStop
}: Props): React.JSX.Element {
  const { t } = useTranslation()
  const [text, setText] = useState('')

  function submit(): void {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
  }

  return (
    <div className="message-input">
      <textarea
        rows={3}
        value={text}
        placeholder={t('chat.messagePlaceholder')}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            submit()
          }
        }}
      />
      <div className="message-input-actions">
        <select
          className="message-input-model"
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
        >
          {MODEL_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {streaming ? (
          <button className="send-button" onClick={onStop}>
            {t('chat.stop')}
          </button>
        ) : (
          <button className="send-button" onClick={submit} disabled={disabled || !text.trim()}>
            {t('chat.send')}
          </button>
        )}
      </div>
    </div>
  )
}

export default MessageInput
