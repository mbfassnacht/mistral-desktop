import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { Conversation, ConversationMode } from '@shared/types'
import * as conversationStore from '../store/conversationStore'
import { syncRemoteConversations } from '../mistral/sync'

export function registerConversationsIpc(): void {
  ipcMain.handle(IPC.CONVERSATIONS_LIST, () => conversationStore.listConversations())

  ipcMain.handle(IPC.CONVERSATIONS_SYNC, async () => {
    await syncRemoteConversations()
    return conversationStore.listConversations()
  })

  ipcMain.handle(IPC.CONVERSATIONS_GET, (_event, id: string) =>
    conversationStore.getConversation(id)
  )

  ipcMain.handle(IPC.CONVERSATIONS_CREATE, (_event, mode: ConversationMode, title: string) =>
    conversationStore.createConversation(mode, title)
  )

  ipcMain.handle(IPC.CONVERSATIONS_DELETE, (_event, id: string) =>
    conversationStore.deleteConversation(id)
  )

  ipcMain.handle(
    IPC.CONVERSATIONS_UPDATE,
    (
      _event,
      id: string,
      partial: Partial<Pick<Conversation, 'title' | 'model' | 'temperature' | 'systemPrompt'>>
    ) => conversationStore.updateConversation(id, partial)
  )
}
