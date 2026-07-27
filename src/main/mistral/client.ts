import { Mistral } from '@mistralai/mistralai'
import { getDecryptedApiKey } from '../store/settingsStore'
import type { Message } from '@shared/types'

export async function getMistralClient(): Promise<Mistral> {
  const apiKey = await getDecryptedApiKey()
  if (!apiKey) {
    throw new Error('No Mistral API key configured. Add one in Settings.')
  }
  return new Mistral({ apiKey })
}

export async function* streamChatComplete(
  model: string,
  temperature: number,
  messages: Message[],
  signal: AbortSignal
): AsyncGenerator<string> {
  const client = await getMistralClient()
  const stream = await client.chat.stream({ model, temperature, messages }, { signal })
  for await (const event of stream) {
    const delta = event.data.choices[0]?.delta?.content
    if (typeof delta === 'string' && delta) yield delta
  }
}

export type CodeStreamEvent =
  | { type: 'conversationStarted'; conversationId: string }
  | { type: 'text'; delta: string }
  | { type: 'toolStarted'; id: string; name: string; args: string }
  | { type: 'toolDelta'; id: string; args: string }
  | { type: 'toolDone'; id: string; name: string; info?: unknown }

// Code mode uses Mistral's Conversations API (client.beta.conversations) rather
// than plain chat completions, since that's what exposes the hosted
// code_interpreter/web_search tools. The Conversations API is stateful on
// Mistral's side: the first turn uses startStream and returns a
// conversationId; every later turn continues via appendStream using that id,
// rather than us resending the full message history ourselves.
export async function* streamCodeTurn(
  model: string,
  systemPrompt: string,
  userMessage: string,
  remoteConversationId: string | undefined,
  signal: AbortSignal
): AsyncGenerator<CodeStreamEvent> {
  const client = await getMistralClient()

  const stream = remoteConversationId
    ? await client.beta.conversations.appendStream(
        {
          conversationId: remoteConversationId,
          conversationAppendStreamRequest: { inputs: userMessage }
        },
        { signal }
      )
    : await client.beta.conversations.startStream(
        {
          inputs: userMessage,
          model,
          instructions: systemPrompt || undefined,
          tools: [{ type: 'code_interpreter' }, { type: 'web_search' }]
        },
        { signal }
      )

  for await (const event of stream) {
    const data = event.data
    switch (data.type) {
      case 'conversation.response.started':
        yield { type: 'conversationStarted', conversationId: data.conversationId }
        break
      case 'message.output.delta':
        if (typeof data.content === 'string' && data.content) {
          yield { type: 'text', delta: data.content }
        }
        break
      case 'tool.execution.started':
        yield { type: 'toolStarted', id: data.id, name: String(data.name), args: data.arguments }
        break
      case 'tool.execution.delta':
        yield { type: 'toolDelta', id: data.id, args: data.arguments }
        break
      case 'tool.execution.done':
        yield { type: 'toolDone', id: data.id, name: String(data.name), info: data.info }
        break
      default:
        break
    }
  }
}

export interface RemoteConversationSummary {
  id: string
  model: string
  name?: string
  instructions?: string
  createdAt: Date
  updatedAt: Date
}

// The Conversations API is stateful on Mistral's side (see streamCodeTurn),
// which means conversations started from any device using this same API key
// are already stored there - list()/getMessages() below let us pull them
// down instead of needing a sync backend of our own. Conversations started
// against an agent (not a base model) come back as a different shape without
// a `model` field; we've never created those, so they're filtered out.
export async function listRemoteConversations(): Promise<RemoteConversationSummary[]> {
  const client = await getMistralClient()
  const result = await client.beta.conversations.list({})
  return result
    .filter((c): c is Extract<(typeof result)[number], { model: string }> => 'model' in c)
    .map((c) => ({
      id: c.id,
      model: c.model,
      name: c.name ?? undefined,
      instructions: c.instructions ?? undefined,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt
    }))
}

function flattenContent(content: string | Array<{ type?: string; text?: string }>): string {
  if (typeof content === 'string') return content
  return content
    .filter((chunk) => chunk.type === 'text' && typeof chunk.text === 'string')
    .map((chunk) => chunk.text)
    .join('')
}

export async function fetchRemoteConversationMessages(conversationId: string): Promise<Message[]> {
  const client = await getMistralClient()
  const result = await client.beta.conversations.getMessages({ conversationId })
  return result.messages.map((entry) => ({
    role: entry.role === 'assistant' ? 'assistant' : 'user',
    content: flattenContent(entry.content),
    createdAt: entry.createdAt ? entry.createdAt.getTime() : undefined
  }))
}
