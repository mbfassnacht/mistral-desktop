import { ipcMain, type IpcMainEvent } from 'electron'
import { IPC } from '@shared/ipc-channels'
import type { ChatSendPayload, Conversation, Message, ToolExecutionRecord } from '@shared/types'
import { streamChatComplete, streamCodeTurn } from '../mistral/client'
import { getConversation, saveConversation } from '../store/conversationStore'
import { titleFromMessage } from '../util/title'

interface InflightRequest {
  controller: AbortController
  cancelled: boolean
}

const inflight = new Map<string, InflightRequest>()

async function runChatTurn(
  event: IpcMainEvent,
  conversation: Conversation,
  state: InflightRequest,
  requestId: string
): Promise<void> {
  const apiMessages: Message[] = conversation.systemPrompt
    ? [{ role: 'system', content: conversation.systemPrompt }, ...conversation.messages]
    : conversation.messages

  let full = ''
  const stream = streamChatComplete(
    conversation.model,
    conversation.temperature,
    apiMessages,
    state.controller.signal
  )
  for await (const delta of stream) {
    if (state.cancelled) break
    full += delta
    event.sender.send(IPC.CHAT_TOKEN, { requestId, delta })
  }
  if (!state.cancelled) {
    conversation.messages.push({ role: 'assistant', content: full, createdAt: Date.now() })
    await saveConversation(conversation)
    event.sender.send(IPC.CHAT_DONE, { requestId, content: full })
  }
}

async function runCodeTurn(
  event: IpcMainEvent,
  conversation: Conversation,
  userMessage: string,
  state: InflightRequest,
  requestId: string
): Promise<void> {
  let full = ''
  const toolExecutions = new Map<string, ToolExecutionRecord>()

  const stream = streamCodeTurn(
    conversation.model,
    conversation.systemPrompt,
    userMessage,
    conversation.remoteConversationId,
    state.controller.signal
  )

  for await (const evt of stream) {
    if (state.cancelled) break
    switch (evt.type) {
      case 'conversationStarted':
        conversation.remoteConversationId = evt.conversationId
        break
      case 'text':
        full += evt.delta
        event.sender.send(IPC.CHAT_TOKEN, { requestId, delta: evt.delta })
        break
      case 'toolStarted': {
        const record: ToolExecutionRecord = {
          id: evt.id,
          name: evt.name,
          arguments: evt.args,
          status: 'running'
        }
        toolExecutions.set(evt.id, record)
        event.sender.send(IPC.CHAT_TOOL, { requestId, execution: record })
        break
      }
      case 'toolDelta': {
        const record = toolExecutions.get(evt.id)
        if (record) {
          record.arguments += evt.args
          event.sender.send(IPC.CHAT_TOOL, { requestId, execution: record })
        }
        break
      }
      case 'toolDone': {
        const record = toolExecutions.get(evt.id)
        if (record) {
          record.status = 'done'
          record.info = evt.info
          event.sender.send(IPC.CHAT_TOOL, { requestId, execution: record })
        }
        break
      }
    }
  }

  if (!state.cancelled) {
    conversation.messages.push({
      role: 'assistant',
      content: full,
      toolExecutions: toolExecutions.size > 0 ? [...toolExecutions.values()] : undefined,
      createdAt: Date.now()
    })
    await saveConversation(conversation)
    event.sender.send(IPC.CHAT_DONE, { requestId, content: full })
  }
}

export function registerChatIpc(): void {
  ipcMain.on(IPC.CHAT_SEND, async (event, payload: ChatSendPayload) => {
    const { requestId, conversationId, userMessage, regenerate } = payload
    const state: InflightRequest = { controller: new AbortController(), cancelled: false }
    inflight.set(requestId, state)

    try {
      const conversation = await getConversation(conversationId)

      if (regenerate) {
        if (conversation.mode === 'code') {
          throw new Error('Regenerate is not supported for Code sessions yet.')
        }
        const last = conversation.messages[conversation.messages.length - 1]
        if (last?.role === 'assistant') conversation.messages.pop()
      } else {
        conversation.messages.push({ role: 'user', content: userMessage, createdAt: Date.now() })
        if (conversation.messages.length === 1) {
          conversation.title = titleFromMessage(userMessage)
        }
      }
      // Persist before calling the model so the prompt survives a crash mid-stream.
      await saveConversation(conversation)

      if (conversation.mode === 'code') {
        await runCodeTurn(event, conversation, userMessage, state, requestId)
      } else {
        await runChatTurn(event, conversation, state, requestId)
      }
    } catch (err) {
      if (!state.cancelled) {
        event.sender.send(IPC.CHAT_ERROR, {
          requestId,
          message: err instanceof Error ? err.message : String(err)
        })
      }
    } finally {
      inflight.delete(requestId)
    }
  })

  ipcMain.on(IPC.CHAT_CANCEL, (_event, requestId: string) => {
    const state = inflight.get(requestId)
    if (!state) return
    state.cancelled = true
    state.controller.abort()
  })
}
