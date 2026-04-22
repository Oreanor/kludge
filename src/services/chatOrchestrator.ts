import { ChatRequest, ChatContext, ChatMessage } from '../types';
import { HistoryService } from './history';

export class ChatOrchestrator {
  constructor(private readonly history?: HistoryService) {}

  buildChatContext(options: Partial<ChatContext> = {}): ChatContext {
    const ctx: ChatContext = Object.assign({ taskKind: 'chat' }, options) as ChatContext;
    return ctx;
  }

  getHistory(conversationId: string) {
    return this.history?.getHistory(conversationId) ?? [];
  }

  async sendChatMessage(request: ChatRequest): Promise<void> {
    // persist incoming user message
    const convId = request.conversationId ?? 'default';
    const last = request.messages && request.messages.length ? request.messages[request.messages.length - 1] : undefined;
    if (last && this.history) {
      await this.history.addMessage(convId, last);
    }
    return;
  }

  async streamChatResponse(request: ChatRequest, onDelta: (delta: string) => void): Promise<void> {
    // naive streaming placeholder: emit words from the last user message and persist final assistant message
    try {
      const last = request.messages && request.messages.length ? request.messages[request.messages.length - 1] : undefined;
      const text = last?.content ?? '';
      const convId = request.conversationId ?? 'default';

      if (last && this.history) {
        // store the user message
        await this.history.addMessage(convId, last);
      }

      if (!text) {
        onDelta('');
        return;
      }

      // split into word/space chunks and stream with small delay
      const chunks = text.split(/(\s+)/).filter(Boolean);
      let assembled = '';
      for (let i = 0; i < chunks.length; i++) {
        const ch = chunks[i];
        onDelta(ch);
        assembled += ch;
        // small delay to emulate streaming
        await new Promise((r) => setTimeout(r, 60));
      }

      // persist assistant message as combined content
      if (this.history) {
        const assistant: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: assembled,
          createdAt: Date.now(),
        };
        await this.history.addMessage(convId, assistant);
      }
    } catch (err) {
      onDelta('[stream-error]');
    }
  }

  async handleToolCall(call: any): Promise<any> {
    return null;
  }
}
