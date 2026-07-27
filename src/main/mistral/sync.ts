import type { Conversation, Message } from '@shared/types'
import { listRemoteConversations, fetchRemoteConversationMessages } from './client'
import * as conversationStore from '../store/conversationStore'
import { getSettings } from '../store/settingsStore'
import { titleFromMessage } from '../util/title'

function titleFromMessages(messages: Message[]): string {
  const firstUser = messages.find((m) => m.role === 'user')
  return firstUser ? titleFromMessage(firstUser.content) : 'Code Session'
}

async function knownRemoteConversationIds(): Promise<Set<string>> {
  const summaries = await conversationStore.listConversations()
  const ids = new Set<string>()
  for (const summary of summaries) {
    if (summary.mode !== 'code') continue
    const conversation = await conversationStore.getConversation(summary.id)
    if (conversation.remoteConversationId) ids.add(conversation.remoteConversationId)
  }
  return ids
}

async function runSync(): Promise<number> {
  let remote
  try {
    remote = await listRemoteConversations()
  } catch {
    return 0
  }
  if (remote.length === 0) return 0

  const known = await knownRemoteConversationIds()
  const missing = remote.filter((r) => !known.has(r.id))
  if (missing.length === 0) return 0

  const settings = await getSettings()
  let added = 0
  for (const r of missing) {
    let messages: Message[]
    try {
      messages = await fetchRemoteConversationMessages(r.id)
    } catch {
      continue
    }
    if (messages.length === 0) continue

    const conversation: Conversation = {
      // Deterministic from the remote id (rather than a fresh random uuid)
      // so backfilling the same conversation twice - e.g. two overlapping
      // sync calls - converges on one local file instead of piling up
      // duplicates.
      id: `remote-${r.id}`,
      title: r.name?.trim() || titleFromMessages(messages),
      model: r.model,
      mode: 'code',
      temperature: settings.defaultTemperature,
      systemPrompt: r.instructions ?? settings.defaultSystemPrompt,
      messages,
      remoteConversationId: r.id,
      createdAt: r.createdAt.getTime(),
      updatedAt: r.updatedAt.getTime()
    }
    await conversationStore.upsertConversation(conversation)
    added++
  }
  return added
}

let inflightSync: Promise<number> | null = null

// Code-mode conversations are already stored server-side by Mistral (see
// streamCodeTurn) - this pulls down any conversation under the current API
// key that isn't already known locally, so Code sessions started on another
// device using the same key show up here too. Regular Chat mode has no
// server-side storage to sync from; this only ever touches mode: 'code'.
// Best-effort: no API key, offline, or a request failure should not block
// startup or surface as an error - it just means nothing gets synced.
//
// Collapses overlapping calls into the one already in flight, since two
// concurrent runs would otherwise both read the "before" local state and
// could both decide the same remote conversation is missing.
export function syncRemoteConversations(): Promise<number> {
  if (!inflightSync) {
    inflightSync = runSync().finally(() => {
      inflightSync = null
    })
  }
  return inflightSync
}
