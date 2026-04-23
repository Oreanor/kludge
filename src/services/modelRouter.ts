import { GEMINI_MODELS } from '../providers/GeminiProvider';
import { GROQ_MODELS } from '../providers/GroqProvider';
import { OPENROUTER_MODELS } from '../providers/OpenRouterProvider';
import { ANTHROPIC_CHAT_MODELS } from '../providers/AnthropicChatProvider';
import { DEEPSEEK_MODELS } from '../providers/DeepSeekProvider';
import { MISTRAL_MODELS } from '../providers/MistralProvider';
import { OPENAI_MODELS } from '../providers/OpenAIProvider';

export const ALL_MODELS = [
  ...OPENAI_MODELS,
  ...GEMINI_MODELS,
  ...ANTHROPIC_CHAT_MODELS,
  ...GROQ_MODELS,
  ...OPENROUTER_MODELS,
  ...DEEPSEEK_MODELS,
  ...MISTRAL_MODELS,
];

export type ModelProvider = 'gemini' | 'groq' | 'openrouter' | 'anthropic' | 'deepseek' | 'mistral' | 'openai' | 'ollama';

export interface ModelDescriptor {
  id: string;
  label: string;
  provider: ModelProvider;
}

export function getModelDescriptor(modelId: string): ModelDescriptor | undefined {
  return ALL_MODELS.find(m => m.id === modelId);
}

export function resolveAutoModel(available: Set<ModelProvider>): string {
  if (available.has('openai'))     { return 'gpt-4o'; }
  if (available.has('groq'))       { return 'llama-3.3-70b-versatile'; }
  if (available.has('gemini'))     { return 'gemini-2.0-flash'; }
  if (available.has('openrouter')) { return 'anthropic/claude-sonnet-4-5'; }
  if (available.has('anthropic'))  { return 'claude-sonnet-4-6'; }
  if (available.has('deepseek'))   { return 'deepseek-chat'; }
  if (available.has('mistral'))    { return 'mistral-large-latest'; }
  if (available.has('ollama'))     { return ''; } // filled dynamically
  return 'echo';
}
