import * as vscode from 'vscode';
import { ChatMessage, ConversationState } from '../types';

const SUMMARY_MAX_LEN = 1200; // символов — жёсткий потолок для summary

export class HistoryService {
  constructor(private readonly state: vscode.Memento) {}

  // ─── ключи хранилища ────────────────────────────────────────────────────────

  private keyState(id: string) { return `conv.state.${id}`; }
  private keyFile(id: string, path: string) { return `conv.file.${id}.${path}`; }

  // ─── чтение / запись состояния ──────────────────────────────────────────────

  getState(conversationId: string): ConversationState {
    return this.state.get<ConversationState>(this.keyState(conversationId), {
      summary: '',
      lastUserMessage: null,
      fileCache: {},
    });
  }

  private async saveState(id: string, s: ConversationState): Promise<void> {
    // fileCache НЕ сохраняем в состоянии — только в отдельных ключах
    const { fileCache: _fc, ...rest } = s;
    await this.state.update(this.keyState(id), rest);
  }

  // ─── user сообщение ─────────────────────────────────────────────────────────

  /**
   * Сохранить входящее сообщение пользователя.
   * Предыдущий lastUserMessage встраивается в summary перед заменой.
   */
  async addUserMessage(conversationId: string, msg: ChatMessage): Promise<void> {
    const s = this.getState(conversationId);

    // вкладываем прошлый user в summary если он был
    if (s.lastUserMessage) {
      s.summary = this.appendToSummary(
        s.summary,
        `User: ${s.lastUserMessage.content}`
      );
    }

    s.lastUserMessage = msg;
    await this.saveState(conversationId, s);
  }

  // ─── ответ ассистента → только в summary ────────────────────────────────────

  /**
   * Ответ ассистента НЕ хранится как сообщение.
   * Только краткий след уходит в summary.
   */
  async addAssistantSummary(conversationId: string, response: string): Promise<void> {
    const s = this.getState(conversationId);
    const short = response.length > 300
      ? response.slice(0, 300) + '…'
      : response;
    s.summary = this.appendToSummary(s.summary, `Assistant: ${short}`);
    await this.saveState(conversationId, s);
  }

  // ─── файловый кэш ────────────────────────────────────────────────────────────

  /**
   * Сохранить файл в кэш (не в историю).
   * Вызывается только когда файл реально понадобился.
   */
  async cacheFile(conversationId: string, filePath: string, content: string): Promise<void> {
    await this.state.update(this.keyFile(conversationId, filePath), content);
  }

  /** Получить файл из кэша (undefined = не кэшировался) */
  getCachedFile(conversationId: string, filePath: string): string | undefined {
    return this.state.get<string>(this.keyFile(conversationId, filePath));
  }

  /** Удалить файл из кэша */
  async evictFile(conversationId: string, filePath: string): Promise<void> {
    await this.state.update(this.keyFile(conversationId, filePath), undefined);
  }

  // ─── сброс ──────────────────────────────────────────────────────────────────

  async clearHistory(conversationId: string): Promise<void> {
    await this.state.update(this.keyState(conversationId), undefined);
  }

  // ─── устаревший API (обратная совместимость) ─────────────────────────────────

  /** @deprecated используй addUserMessage / addAssistantSummary */
  getHistory(conversationId: string): ChatMessage[] {
    const s = this.getState(conversationId);
    return s.lastUserMessage ? [s.lastUserMessage] : [];
  }

  /** @deprecated используй addUserMessage */
  async addMessage(conversationId: string, msg: ChatMessage): Promise<void> {
    if (msg.role === 'user') {
      await this.addUserMessage(conversationId, msg);
    } else if (msg.role === 'assistant') {
      await this.addAssistantSummary(conversationId, msg.content);
    }
  }

  // ─── утилиты ────────────────────────────────────────────────────────────────

  private appendToSummary(summary: string, line: string): string {
    const joined = summary ? `${summary}\n${line}` : line;
    // обрезаем с конца — свежее важнее
    return joined.length > SUMMARY_MAX_LEN
      ? '…' + joined.slice(joined.length - SUMMARY_MAX_LEN)
      : joined;
  }
}
