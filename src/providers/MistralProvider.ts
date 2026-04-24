import { OpenAICompatibleProvider } from './OpenAICompatibleProvider';

export const MISTRAL_MODELS = [
  { id: 'mistral-large-latest', label: 'Mistral Large', provider: 'mistral' as const },
  { id: 'mistral-small-latest', label: 'Mistral Small', provider: 'mistral' as const },
  { id: 'codestral-latest',     label: 'Codestral',     provider: 'mistral' as const },
  { id: 'open-mistral-nemo',    label: 'Mistral Nemo',  provider: 'mistral' as const },
];

export class MistralProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string) {
    super(apiKey, 'api.mistral.ai', '/v1/chat/completions', 'Mistral');
  }
}
