export const SCHEDULE_KEY            = 'kludge.scheduledPrompts';
export const DISABLED_PROVIDERS_KEY  = 'kludge.disabledProviders';
export const SESSIONS_KEY            = 'kludge.sessions';
export const ACTIVE_SESSION_KEY      = 'kludge.activeSession';
export const TELEGRAM_TOKEN_KEY      = 'kludge.telegram.token';
export const TELEGRAM_CHAT_ID_KEY    = 'kludge.telegram.chatId';
export const TELEGRAM_SESSION_ID     = 'telegram';
export const MAX_DISPLAY_PAIRS       = 30;

export const FILE_PATH_RE   = /`([^`\s]+\.[a-zA-Z]{1,6})`/g;
export const FILE_SIZE_LIMIT   = 8_000;
export const TOTAL_FILES_LIMIT = 40_000;

export const PROVIDER_DEFS = [
  { id: 'gemini',     name: 'Google Gemini',  secretKey: 'kludge.provider.gemini'     },
  { id: 'groq',       name: 'Groq',           secretKey: 'kludge.provider.groq'       },
  { id: 'openrouter', name: 'OpenRouter',     secretKey: 'kludge.provider.openrouter' },
  { id: 'anthropic',  name: 'Anthropic',      secretKey: 'kludge.provider.anthropic'  },
  { id: 'deepseek',   name: 'DeepSeek',       secretKey: 'kludge.provider.deepseek'   },
  { id: 'mistral',    name: 'Mistral',        secretKey: 'kludge.provider.mistral'    },
  { id: 'openai',     name: 'OpenAI',         secretKey: 'kludge.provider.openai'     },
  { id: 'ollama',     name: 'Ollama (local)', secretKey: 'kludge.provider.ollama', placeholder: 'http://localhost:11434' },
] as const;

export type ProviderDefId = typeof PROVIDER_DEFS[number]['id'];
