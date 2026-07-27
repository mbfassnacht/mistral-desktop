import { app, safeStorage } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'
import type { ApiKeyStatus, Settings } from '@shared/types'
import { readJson, writeJsonAtomic } from './fsUtils'

const DEFAULT_SETTINGS: Settings = {
  defaultModel: 'mistral-large-latest',
  defaultTemperature: 0.7,
  defaultSystemPrompt: ''
}

function settingsFilePath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

function apiKeyFilePath(): string {
  return path.join(app.getPath('userData'), 'secure', 'apikey.enc')
}

export async function getSettings(): Promise<Settings> {
  const stored = await readJson<Partial<Settings>>(settingsFilePath(), {})
  return { ...DEFAULT_SETTINGS, ...stored }
}

export async function setSettings(partial: Partial<Settings>): Promise<Settings> {
  const current = await getSettings()
  const next = { ...current, ...partial }
  await writeJsonAtomic(settingsFilePath(), next)
  return next
}

export async function getApiKeyStatus(): Promise<ApiKeyStatus> {
  if (!safeStorage.isEncryptionAvailable()) return 'unavailable'
  try {
    await fs.access(apiKeyFilePath())
    return 'set'
  } catch {
    return 'unset'
  }
}

export async function setApiKey(key: string): Promise<void> {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure storage is not available on this system.')
  }
  const encrypted = safeStorage.encryptString(key)
  const filePath = apiKeyFilePath()
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const tmpPath = `${filePath}.tmp`
  await fs.writeFile(tmpPath, encrypted)
  await fs.rename(tmpPath, filePath)
}

export async function clearApiKey(): Promise<void> {
  try {
    await fs.unlink(apiKeyFilePath())
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
}

// Internal only — never exposed over IPC. The decrypted key must never reach the renderer.
export async function getDecryptedApiKey(): Promise<string | null> {
  if (!safeStorage.isEncryptionAvailable()) return null
  try {
    const encrypted = await fs.readFile(apiKeyFilePath())
    return safeStorage.decryptString(encrypted)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}
