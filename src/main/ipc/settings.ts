import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { Settings } from '@shared/types'
import * as settingsStore from '../store/settingsStore'

export function registerSettingsIpc(): void {
  ipcMain.handle(IPC.SETTINGS_GET, () => settingsStore.getSettings())

  ipcMain.handle(IPC.SETTINGS_SET, (_event, partial: Partial<Settings>) =>
    settingsStore.setSettings(partial)
  )

  ipcMain.handle(IPC.SETTINGS_SET_API_KEY, (_event, key: string) => settingsStore.setApiKey(key))

  ipcMain.handle(IPC.SETTINGS_API_KEY_STATUS, () => settingsStore.getApiKeyStatus())

  ipcMain.handle(IPC.SETTINGS_CLEAR_API_KEY, () => settingsStore.clearApiKey())
}
