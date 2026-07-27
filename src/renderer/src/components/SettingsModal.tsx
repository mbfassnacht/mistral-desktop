import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ApiKeyStatus, Settings } from '@shared/types'
import { SUPPORTED_LANGUAGES } from '../i18n'
import { MODEL_OPTIONS } from '../models'

interface Props {
  onClose: () => void
}

function SettingsModal({ onClose }: Props): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    window.api.settings.get().then(setSettings)
    window.api.settings.apiKeyStatus().then(setApiKeyStatus)
  }, [])

  function statusLabel(status: ApiKeyStatus | null): string {
    switch (status) {
      case 'set':
        return t('settings.statusSet')
      case 'unset':
        return t('settings.statusUnset')
      case 'unavailable':
        return t('settings.statusUnavailable')
      default:
        return ''
    }
  }

  async function handleSaveApiKey(): Promise<void> {
    setSaveError(null)
    try {
      await window.api.settings.setApiKey(apiKeyInput)
      setApiKeyInput('')
      setApiKeyStatus(await window.api.settings.apiKeyStatus())
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleClearApiKey(): Promise<void> {
    await window.api.settings.clearApiKey()
    setApiKeyStatus(await window.api.settings.apiKeyStatus())
  }

  async function updateSettings(partial: Partial<Settings>): Promise<void> {
    const next = await window.api.settings.set(partial)
    setSettings(next)
  }

  if (!settings || apiKeyStatus === null) {
    return (
      <div className="modal-overlay">
        <div className="modal">{t('settings.loading')}</div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('settings.title')}</h2>
          <button className="icon-button" onClick={onClose} aria-label={t('settings.close')}>
            ✕
          </button>
        </div>

        <section className="modal-section">
          <label htmlFor="language">{t('settings.language')}</label>
          <select
            id="language"
            value={i18n.language}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        </section>

        <section className="modal-section">
          <label htmlFor="api-key">{t('settings.apiKeyLabel')}</label>
          <div className="api-key-row">
            <input
              id="api-key"
              type="password"
              placeholder={t('settings.apiKeyPlaceholder')}
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              disabled={apiKeyStatus === 'unavailable'}
            />
            <button
              onClick={handleSaveApiKey}
              disabled={!apiKeyInput || apiKeyStatus === 'unavailable'}
            >
              {t('settings.save')}
            </button>
            <button onClick={handleClearApiKey} disabled={apiKeyStatus !== 'set'}>
              {t('settings.clear')}
            </button>
          </div>
          <p className={apiKeyStatus === 'unavailable' ? 'status-warning' : 'status-text'}>
            {statusLabel(apiKeyStatus)}
          </p>
          {saveError && <p className="status-warning">{saveError}</p>}
        </section>

        <section className="modal-section">
          <label htmlFor="default-model">{t('settings.defaultModel')}</label>
          <select
            id="default-model"
            value={settings.defaultModel}
            onChange={(e) => updateSettings({ defaultModel: e.target.value })}
          >
            {MODEL_OPTIONS.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </section>

        <section className="modal-section">
          <label htmlFor="default-temperature">
            {t('settings.defaultTemperature', { value: settings.defaultTemperature })}
          </label>
          <input
            id="default-temperature"
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={settings.defaultTemperature}
            onChange={(e) => updateSettings({ defaultTemperature: Number(e.target.value) })}
          />
        </section>

        <section className="modal-section">
          <label htmlFor="default-system-prompt">{t('settings.defaultSystemPrompt')}</label>
          <textarea
            id="default-system-prompt"
            rows={4}
            value={settings.defaultSystemPrompt}
            onChange={(e) => updateSettings({ defaultSystemPrompt: e.target.value })}
          />
        </section>

        <section className="modal-section">
          <label>{t('settings.about')}</label>
          <p className="status-text">{t('settings.aboutDisclaimer')}</p>
        </section>
      </div>
    </div>
  )
}

export default SettingsModal
