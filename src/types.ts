export type ProviderId = 'openai' | 'anthropic' | 'google' | 'ollama' | 'openrouter' | 'custom';

export interface ScheduledTask {
  id: string
  text: string
  scheduledAt: number
  completedAt?: number
}

export interface DisplayPair { user: string; assistant: string }

export interface StoredSession { id: string; name: string; createdAt: number }

export type ApiMsg = { role: 'user' | 'assistant'; content: string }
export type TaskKind = 'chat' | 'edit' | 'preview' | 'icons' | 'image' | 'search' | 'agent';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  createdAt: number;
  toolName?: string;
}

export interface ChatContext {
  selectedText?: string;
  activeFile?: string;
  activeFileContent?: string;
  workspaceFiles?: string[];
  symbols?: string[];
  taskKind: TaskKind;
}

export interface ChatRequest {
  conversationId: string;
  messages: ChatMessage[];
  context: ChatContext;
  modelId: string;
  systemExtra?: string;
}

export interface ConversationTurn {
  user: string;
  assistant: string;
}

export interface ConversationState {
  turns: ConversationTurn[];
  lastUserMessage: ChatMessage | null;
  /** path → content, загружается по запросу, не шлётся в API автоматически */
  fileCache: Record<string, string>;
}
