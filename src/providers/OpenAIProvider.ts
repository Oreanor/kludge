import { OpenAICompatibleProvider } from './OpenAICompatibleProvider';

export const OPENAI_MODELS = [
  { id: 'gpt-4o',      label: 'GPT-4o',      provider: 'openai' as const },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini', provider: 'openai' as const },
  { id: 'o3-mini',     label: 'o3 mini',      provider: 'openai' as const },
  { id: 'o1-mini',     label: 'o1 mini',      provider: 'openai' as const },
];

export class OpenAIProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string) {
    super(apiKey, 'api.openai.com', '/v1/chat/completions', 'OpenAI');
  }
}
