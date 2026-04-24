import { OpenAICompatibleProvider } from './OpenAICompatibleProvider';

export const DEEPSEEK_MODELS = [
  { id: 'deepseek-chat',     label: 'DeepSeek V3', provider: 'deepseek' as const },
  { id: 'deepseek-reasoner', label: 'DeepSeek R1', provider: 'deepseek' as const },
];

export class DeepSeekProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string) {
    super(apiKey, 'api.deepseek.com', '/chat/completions', 'DeepSeek');
  }
}
