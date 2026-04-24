import { OpenAICompatibleProvider } from './OpenAICompatibleProvider';

export const OPENROUTER_MODELS = [
  { id: 'anthropic/claude-sonnet-4-5',      label: 'Claude Sonnet 4.5 (OR)', provider: 'openrouter' as const },
  { id: 'google/gemini-2.0-flash',           label: 'Gemini 2.0 Flash (OR)',  provider: 'openrouter' as const },
  { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B (OR)',     provider: 'openrouter' as const },
  { id: 'deepseek/deepseek-r1',              label: 'DeepSeek R1 (OR)',        provider: 'openrouter' as const },
];

export class OpenRouterProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string) {
    super(apiKey, 'openrouter.ai', '/api/v1/chat/completions', 'OpenRouter');
  }
}
