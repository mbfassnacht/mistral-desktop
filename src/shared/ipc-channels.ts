export const IPC = {
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_SET_API_KEY: 'settings:setApiKey',
  SETTINGS_API_KEY_STATUS: 'settings:apiKeyStatus',
  SETTINGS_CLEAR_API_KEY: 'settings:clearApiKey',

  CONVERSATIONS_LIST: 'conversations:list',
  CONVERSATIONS_GET: 'conversations:get',
  CONVERSATIONS_CREATE: 'conversations:create',
  CONVERSATIONS_DELETE: 'conversations:delete',
  CONVERSATIONS_UPDATE: 'conversations:update',
  CONVERSATIONS_SYNC: 'conversations:sync',

  CHAT_SEND: 'chat:send',
  CHAT_CANCEL: 'chat:cancel',
  CHAT_TOKEN: 'chat:token',
  CHAT_TOOL: 'chat:tool',
  CHAT_DONE: 'chat:done',
  CHAT_ERROR: 'chat:error'
} as const
