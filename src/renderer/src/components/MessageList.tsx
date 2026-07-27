import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Message, ToolExecutionRecord } from '@shared/types'
import mistralIconMono from '../assets/mistral-icon-mono.svg'

interface Props {
  messages: Message[]
  onRegenerate?: () => void
  regenerateEnabled?: boolean
}

function formatTime(ts: number | undefined, locale: string): string {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
}

function extractOutput(info: unknown): string | null {
  if (!info || typeof info !== 'object') return null
  const obj = info as Record<string, unknown>
  for (const key of ['output', 'result', 'stdout', 'text']) {
    if (typeof obj[key] === 'string') return obj[key] as string
  }
  return Object.keys(obj).length > 0 ? JSON.stringify(obj, null, 2) : null
}

function ToolExecutionCard({ execution }: { execution: ToolExecutionRecord }): React.JSX.Element {
  const { t } = useTranslation()
  const label =
    execution.status === 'running'
      ? t('message.toolRunning', { name: execution.name })
      : t('message.toolDone', { name: execution.name })
  const output = execution.status === 'done' ? extractOutput(execution.info) : null

  return (
    <div className="tool-execution">
      <div className="tool-execution-label">{label}</div>
      {execution.arguments && <pre className="tool-execution-code">{execution.arguments}</pre>}
      {output && <pre className="tool-execution-output">{output}</pre>}
    </div>
  )
}

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // Clipboard access denied by the OS; nothing actionable to do here.
  }
}

function MessageList({ messages, onRegenerate, regenerateEnabled }: Props): React.JSX.Element {
  const { t, i18n } = useTranslation()

  return (
    <div className="message-list">
      {messages.map((message, i) => {
        const timestamp = formatTime(message.createdAt, i18n.language)

        if (message.role === 'user') {
          return (
            <div key={i} className="message-row message-row-user">
              <div className="message message-user">
                {message.content && <div className="message-content">{message.content}</div>}
              </div>
              <div className="message-actions message-actions-user">
                <button
                  className="message-action-button"
                  onClick={() => copyToClipboard(message.content)}
                  aria-label={t('message.copy')}
                >
                  ⧉
                </button>
                {timestamp && <span className="message-timestamp">{timestamp}</span>}
              </div>
            </div>
          )
        }

        const showRegenerate = regenerateEnabled && i === messages.length - 1

        return (
          <div key={i} className="message-row message-row-assistant">
            <img className="message-avatar" src={mistralIconMono} alt="" />
            <div className="message-body">
              {message.toolExecutions?.map((execution) => (
                <ToolExecutionCard key={execution.id} execution={execution} />
              ))}
              {message.content && (
                <div className="message-content markdown-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                </div>
              )}
              <div className="message-actions">
                <button
                  className="message-action-button"
                  onClick={() => copyToClipboard(message.content)}
                  aria-label={t('message.copy')}
                >
                  ⧉
                </button>
                {showRegenerate && (
                  <button
                    className="message-action-button"
                    onClick={onRegenerate}
                    aria-label={t('message.regenerate')}
                  >
                    ↻
                  </button>
                )}
                {timestamp && <span className="message-timestamp">{timestamp}</span>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default MessageList
