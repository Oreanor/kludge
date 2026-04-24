import * as vscode from 'vscode';
import { ChatOrchestrator } from './chatOrchestrator';
import { PROVIDER_DEFS, DISABLED_PROVIDERS_KEY, ProviderDefId } from '../constants';

export class ProviderManager {
  private _softRemoved = new Set<string>();

  constructor(
    private readonly secrets: vscode.SecretStorage,
    private readonly globalState: vscode.Memento,
    private readonly orchestrator: ChatOrchestrator | undefined,
    private readonly postMessage: (msg: any) => void,
  ) {}

  async loadProviderKeys(): Promise<void> {
    for (const def of PROVIDER_DEFS) {
      const key = await this.secrets.get(def.secretKey);
      if (key && this.orchestrator) { await this._applyKey(def.id, key); }
    }
  }

  async sendProviders(): Promise<void> {
    const providers = await Promise.all(PROVIDER_DEFS.map(async def => {
      const key = await this.secrets.get(def.secretKey);
      const soft = this._softRemoved.has(def.id);
      const isUrl = def.id === 'ollama';
      const mask = (k: string) => isUrl ? k : '••••' + k.slice(-4);
      return {
        id:             def.id,
        name:           def.name,
        configured:     !!key && !soft,
        maskedKey:      key && !soft ? mask(key) : undefined,
        pendingRemoval: soft && !!key,
        pendingMasked:  soft && key ? mask(key) : undefined,
        placeholder:    (def as any).placeholder as string | undefined,
      };
    }));
    const disabledProviders = this.getDisabledProviders();
    this.postMessage({ type: 'providers', providers, disabledProviders });
  }

  async saveKey(providerId: string, key: string): Promise<void> {
    const def = PROVIDER_DEFS.find(d => d.id === providerId);
    if (!def || !key) { return; }
    await this.secrets.store(def.secretKey, key);
    this._softRemoved.delete(def.id);
    await this._applyKey(def.id, key);
  }

  removeKey(providerId: string): void {
    const def = PROVIDER_DEFS.find(d => d.id === providerId);
    if (!def) { return; }
    this._softRemoved.add(def.id);
    if (this.orchestrator) { this.orchestrator.removeProvider(def.id); }
  }

  async restoreKey(providerId: string): Promise<void> {
    const def = PROVIDER_DEFS.find(d => d.id === providerId);
    if (!def) { return; }
    this._softRemoved.delete(def.id);
    const key = await this.secrets.get(def.secretKey);
    if (key) { await this._applyKey(def.id, key); }
  }

  async toggleDisabled(providerId: string): Promise<void> {
    const disabled = new Set(this.getDisabledProviders());
    if (disabled.has(providerId)) { disabled.delete(providerId); } else { disabled.add(providerId); }
    await this.globalState.update(DISABLED_PROVIDERS_KEY, [...disabled]);
  }

  getDisabledProviders(): string[] {
    return this.globalState.get<string[]>(DISABLED_PROVIDERS_KEY, []);
  }

  private async _applyKey(id: ProviderDefId, key: string): Promise<void> {
    if (!this.orchestrator) { return; }
    if (id === 'gemini')     { this.orchestrator.setGeminiKey(key); }
    if (id === 'groq')       { this.orchestrator.setGroqKey(key); }
    if (id === 'openrouter') { this.orchestrator.setOpenRouterKey(key); }
    if (id === 'anthropic')  { this.orchestrator.setAnthropicKey(key); }
    if (id === 'deepseek')   { this.orchestrator.setDeepSeekKey(key); }
    if (id === 'mistral')    { this.orchestrator.setMistralKey(key); }
    if (id === 'openai')     { this.orchestrator.setOpenAIKey(key); }
    if (id === 'ollama')     { await this.orchestrator.setOllamaUrl(key); }
  }
}
