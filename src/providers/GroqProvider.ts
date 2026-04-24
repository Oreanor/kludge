import { OpenAICompatibleProvider } from './OpenAICompatibleProvider';

export const GROQ_MODELS = [
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', provider: 'groq' as const },
  { id: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B',  provider: 'groq' as const },
  { id: 'mixtral-8x7b-32768',      label: 'Mixtral 8x7B',  provider: 'groq' as const },
  { id: 'gemma2-9b-it',            label: 'Gemma 2 9B',     provider: 'groq' as const },
];

export class GroqProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string) {
    super(apiKey, 'api.groq.com', '/openai/v1/chat/completions', 'Groq');
  }
}
