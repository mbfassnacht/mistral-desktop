import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC } from '@shared/ipc-channels'
import type {
  ApiKeyStatus,
  ChatDoneEvent,
  ChatErrorEvent,
  ChatSendPayload,
  ChatTokenEvent,
  ChatToolEvent,
  Conversation,
  ConversationMode,
  ConversationSummary,
  Settings
} from '@shared/types'

// Custom APIs for renderer
const api = {
  settings: {
    get: (): Promise<Settings> => ipcRenderer.invoke(IPC.SETTINGS_GET),
    set: (partial: Partial<Settings>): Promise<Settings> =>
      ipcRenderer.invoke(IPC.SETTINGS_SET, partial),
    setApiKey: (key: string): Promise<void> => ipcRenderer.invoke(IPC.SETTINGS_SET_API_KEY, key),
    apiKeyStatus: (): Promise<ApiKeyStatus> => ipcRenderer.invoke(IPC.SETTINGS_API_KEY_STATUS),
    clearApiKey: (): Promise<void> => ipcRenderer.invoke(IPC.SETTINGS_CLEAR_API_KEY)
  },
  chat: {
    send: (payload: ChatSendPayload): void => ipcRenderer.send(IPC.CHAT_SEND, payload),
    cancel: (requestId: string): void => ipcRenderer.send(IPC.CHAT_CANCEL, requestId),
    onToken: (cb: (e: ChatTokenEvent) => void): (() => void) => {
      const listener = (_: unknown, data: ChatTokenEvent): void => cb(data)
      ipcRenderer.on(IPC.CHAT_TOKEN, listener)
      return () => ipcRenderer.removeListener(IPC.CHAT_TOKEN, listener)
    },
    onTool: (cb: (e: ChatToolEvent) => void): (() => void) => {
      const listener = (_: unknown, data: ChatToolEvent): void => cb(data)
      ipcRenderer.on(IPC.CHAT_TOOL, listener)
      return () => ipcRenderer.removeListener(IPC.CHAT_TOOL, listener)
    },
    onDone: (cb: (e: ChatDoneEvent) => void): (() => void) => {
      const listener = (_: unknown, data: ChatDoneEvent): void => cb(data)
      ipcRenderer.on(IPC.CHAT_DONE, listener)
      return () => ipcRenderer.removeListener(IPC.CHAT_DONE, listener)
    },
    onError: (cb: (e: ChatErrorEvent) => void): (() => void) => {
      const listener = (_: unknown, data: ChatErrorEvent): void => cb(data)
      ipcRenderer.on(IPC.CHAT_ERROR, listener)
      return () => ipcRenderer.removeListener(IPC.CHAT_ERROR, listener)
    }
  },
  conversations: {
    list: (): Promise<ConversationSummary[]> => ipcRenderer.invoke(IPC.CONVERSATIONS_LIST),
    sync: (): Promise<ConversationSummary[]> => ipcRenderer.invoke(IPC.CONVERSATIONS_SYNC),
    get: (id: string): Promise<Conversation> => ipcRenderer.invoke(IPC.CONVERSATIONS_GET, id),
    create: (mode: ConversationMode, title: string): Promise<Conversation> =>
      ipcRenderer.invoke(IPC.CONVERSATIONS_CREATE, mode, title),
    delete: (id: string): Promise<void> => ipcRenderer.invoke(IPC.CONVERSATIONS_DELETE, id),
    update: (
      id: string,
      partial: Partial<Pick<Conversation, 'title' | 'model' | 'temperature' | 'systemPrompt'>>
    ): Promise<Conversation> => ipcRenderer.invoke(IPC.CONVERSATIONS_UPDATE, id, partial)
  }
}

export type Api = typeof api

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
