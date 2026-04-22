import { GEMINI_MODELS } from '../providers/GeminiProvider';
import { GROQ_MODELS } from '../providers/GroqProvider';

export const ALL_MODELS = [
  ...GEMINI_MODELS,
  ...GROQ_MODELS,
];

export type ModelProvider = 'gemini' | 'groq';

export interface ModelDescriptor {
  id: string;
  label: string;
  provider: ModelProvider;
}

export function getModelDescriptor(modelId: string): ModelDescriptor | undefined {
  return ALL_MODELS.find(m => m.id === modelId);
}

/** Returns the best available model given which providers are initialised. */
export function resolveAutoModel(available: Set<ModelProvider>): string {
  if (available.has('groq'))   { return 'llama-3.3-70b-versatile'; }
  if (available.has('gemini')) { return 'gemini-2.0-flash'; }
  return 'echo';
}
