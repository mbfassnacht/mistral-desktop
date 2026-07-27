import { app } from 'electron'
import { promises as fs } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import type { Conversation, ConversationMode, ConversationSummary } from '@shared/types'
import { readJson, writeJsonAtomic } from './fsUtils'
import { getSettings } from './settingsStore'

function conversationsDir(): string {
  return path.join(app.getPath('userData'), 'conversations')
}

function indexFilePath(): string {
  return path.join(conversationsDir(), 'index.json')
}

function conversationFilePath(id: string): string {
  return path.join(conversationsDir(), `${id}.json`)
}

function toSummary(conversation: Conversation): ConversationSummary {
  const { id, title, model, mode, createdAt, updatedAt } = conversation
  return { id, title, model, mode, createdAt, updatedAt }
}

export async function listConversations(): Promise<ConversationSummary[]> {
  return readJson<ConversationSummary[]>(indexFilePath(), [])
}

// index.json is a shared read-modify-write resource: concurrent callers
// (e.g. two conversation creations firing at once) must not read the same
// "before" state and clobber each other's update. Serialize the whole
// read-modify-write sequence through this queue rather than just the final
// write.
let indexQueue: Promise<unknown> = Promise.resolve()

function withIndexLock<T>(fn: (index: ConversationSummary[]) => Promise<T>): Promise<T> {
  const result = indexQueue.then(() => listConversations().then(fn))
  indexQueue = result.catch(() => {})
  return result
}

export async function getConversation(id: string): Promise<Conversation> {
  const conversation = await readJson<Partial<Conversation> | null>(conversationFilePath(id), null)
  if (!conversation) {
    throw new Error(`Conversation not found: ${id}`)
  }
  // Conversations persisted before code mode existed don't have a `mode`
  // field on disk; treat those as plain chat conversations.
  return { ...conversation, mode: conversation.mode ?? 'chat' } as Conversation
}

export async function createConversation(
  mode: ConversationMode = 'chat',
  title: string
): Promise<Conversation> {
  const settings = await getSettings()
  const now = Date.now()
  const conversation: Conversation = {
    id: randomUUID(),
    title,
    model: settings.defaultModel,
    mode,
    temperature: settings.defaultTemperature,
    systemPrompt: settings.defaultSystemPrompt,
    messages: [],
    createdAt: now,
    updatedAt: now
  }
  await writeJsonAtomic(conversationFilePath(conversation.id), conversation)
  await withIndexLock(async (index) => {
    index.unshift(toSummary(conversation))
    await writeJsonAtomic(indexFilePath(), index)
  })
  return conversation
}

export async function deleteConversation(id: string): Promise<void> {
  try {
    await fs.unlink(conversationFilePath(id))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
  await withIndexLock(async (index) => {
    await writeJsonAtomic(
      indexFilePath(),
      index.filter((c) => c.id !== id)
    )
  })
}

export async function saveConversation(conversation: Conversation): Promise<Conversation> {
  const next: Conversation = { ...conversation, updatedAt: Date.now() }
  await writeJsonAtomic(conversationFilePath(next.id), next)
  await withIndexLock(async (index) => {
    const i = index.findIndex((c) => c.id === next.id)
    if (i !== -1) {
      index[i] = toSummary(next)
      await writeJsonAtomic(indexFilePath(), index)
    }
  })
  return next
}

// Unlike saveConversation, works whether or not the conversation already has
// an index.json entry - used when backfilling conversations pulled down from
// Mistral's Conversations API that were never created locally.
export async function upsertConversation(conversation: Conversation): Promise<Conversation> {
  await writeJsonAtomic(conversationFilePath(conversation.id), conversation)
  await withIndexLock(async (index) => {
    const i = index.findIndex((c) => c.id === conversation.id)
    const summary = toSummary(conversation)
    if (i === -1) {
      index.unshift(summary)
    } else {
      index[i] = summary
    }
    await writeJsonAtomic(indexFilePath(), index)
  })
  return conversation
}

export async function updateConversation(
  id: string,
  partial: Partial<Pick<Conversation, 'title' | 'model' | 'temperature' | 'systemPrompt'>>
): Promise<Conversation> {
  const current = await getConversation(id)
  return saveConversation({ ...current, ...partial })
}
