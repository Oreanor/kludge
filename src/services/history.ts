import * as vscode from 'vscode';
import { ChatMessage } from '../types';

export class HistoryService {
  constructor(private readonly state: vscode.Memento) {}

  private key(conversationId: string) {
    return `chat.history.${conversationId}`;
  }

  getHistory(conversationId: string): ChatMessage[] {
    return this.state.get<ChatMessage[]>(this.key(conversationId), []);
  }

  async addMessage(conversationId: string, msg: ChatMessage): Promise<void> {
    const hist = this.getHistory(conversationId);
    hist.push(msg);
    await this.state.update(this.key(conversationId), hist);
  }

  async clearHistory(conversationId: string): Promise<void> {
    await this.state.update(this.key(conversationId), []);
  }
}
