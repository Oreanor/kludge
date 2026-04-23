import * as vscode from 'vscode';
import { ChatRequest, ChatContext, ChatMessage } from '../types';
import { HistoryService } from './history';
import { GeminiProvider } from '../providers/GeminiProvider';
import { GroqProvider } from '../providers/GroqProvider';
import { ALL_MODELS, ModelProvider, getModelDescriptor, resolveAutoModel } from './modelRouter';

export class ChatOrchestrator {
  private gemini?: GeminiProvider;
  private groq?: GroqProvider;
  private availableProviders = new Set<ModelProvider>();

  constructor(private readonly history?: HistoryService) {}

  setGeminiKey(apiKey: string) {
    this.gemini = new GeminiProvider(apiKey);
    this.availableProviders.add('gemini');
  }

  setGroqKey(apiKey: string) {
    this.groq = new GroqProvider(apiKey);
    this.availableProviders.add('groq');
  }

  getAvailableModels() {
    return ALL_MODELS.filter(m => this.availableProviders.has(m.provider));
  }

  getHistory(conversationId: string): ChatMessage[] {
    return this.history?.getHistory(conversationId) ?? [];
  }

  async clearHistory(conversationId: string) {
    await this.history?.clearHistory(conversationId);
  }

  async loadFileIfNeeded(conversationId: string, filePath: string): Promise<string | undefined> {
    if (!this.history) { return undefined; }
    const cached = this.history.getCachedFile(conversationId, filePath);
    if (cached !== undefined) { return cached; }
    try {
      const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
      const content = Buffer.from(bytes).toString('utf8');
      await this.history.cacheFile(conversationId, filePath, content);
      return content;
    } catch { return undefined; }
  }

  async streamChatResponse(
    request: ChatRequest,
    onDelta: (delta: string) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const convId = request.conversationId ?? 'default';
    const userMsg = request.messages?.at(-1);

    if (userMsg && this.history) {
      await this.history.addUserMessage(convId, userMsg);
    }

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';

    const systemPrompt = [
      'Ты AI-ассистент встроенный в VS Code расширение Kludge Code.',
      `Рабочая директория: ${workspaceRoot}`,
      'Отвечай на языке пользователя.',
    ].join('\n');

    const apiMessages: { role: 'user' | 'assistant'; content: string }[] = [];

    if (this.history) {
      const state = this.history.getState(convId);
      if (state.summary) {
        apiMessages.push({ role: 'user',      content: `[Контекст предыдущего разговора]\n${state.summary}` });
        apiMessages.push({ role: 'assistant', content: 'Понял контекст, продолжаю.' });
      }
    }

    if (userMsg) {
      apiMessages.push({ role: 'user', content: userMsg.content });
    }

    if (apiMessages.length === 0) { return; }

    // ── resolve model ────────────────────────────────────────────────────────
    let modelId = request.modelId;
    if (!modelId || modelId === 'default' || modelId === 'auto') {
      modelId = resolveAutoModel(this.availableProviders);
    }

    const descriptor = getModelDescriptor(modelId);
    const provider = descriptor?.provider;

    console.log(`[Kludge] Using model: ${modelId} (${provider ?? 'unknown'})`);

    let assembled = '';
    let gen: AsyncIterable<string>;

    if (provider === 'gemini' && this.gemini) {
      gen = this.gemini.stream(apiMessages, modelId, systemPrompt);
    } else if (provider === 'groq' && this.groq) {
      gen = this.groq.stream(apiMessages, modelId, systemPrompt);
    } else {
      // echo fallback
      assembled = `[Echo — нет доступных провайдеров] ${userMsg?.content ?? ''}`;
      for (const chunk of assembled.split(/(\s+)/)) {
        if (signal?.aborted) { return; }
        if (chunk) { onDelta(chunk); }
        await new Promise(r => setTimeout(r, 30));
      }
      if (this.history && assembled) {
        await this.history.addAssistantSummary(convId, assembled);
      }
      return;
    }

    try {
      for await (const chunk of gen) {
        if (signal?.aborted) { return; }
        onDelta(chunk);
        assembled += chunk;
      }
    } catch (err: any) {
      const errMsg = `\n\n⚠️ Ошибка: ${err?.message ?? String(err)}`;
      onDelta(errMsg);
      assembled += errMsg;
    }

    if (this.history && assembled) {
      await this.history.addAssistantSummary(convId, assembled);
    }
  }
}
