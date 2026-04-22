import Anthropic from '@anthropic-ai/sdk';
import { TOOLS, executeTool } from '../services/agentTools';

// Актуальные модели Anthropic (обновляй при необходимости)
export const ANTHROPIC_MODELS = [
  { id: 'claude-opus-4-6',    label: 'Claude Opus 4.6 (мощный)'    },
  { id: 'claude-sonnet-4-6',  label: 'Claude Sonnet 4.6 (баланс)'  },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (быстрый)' },
] as const;

export type AnthropicModelId = typeof ANTHROPIC_MODELS[number]['id'];

export class AnthropicProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  /**
   * Настоящий SSE-стриминг через Anthropic SDK.
   * Агентный loop: если модель вызывает tools — выполняем и продолжаем.
   */
  async *stream(
    messages: { role: 'user' | 'assistant'; content: any }[],
    model: AnthropicModelId | string = 'claude-sonnet-4-6',
    workspaceRoot: string,
    onConfirm: (msg: string) => Promise<boolean>,
    onToolCall?: (name: string, description: string) => void
  ): AsyncIterable<string> {

    let currentMessages = [...messages];

    // agent loop — повторяем пока модель не вернёт stop_reason: 'end_turn'
    while (true) {
      // ── настоящий SSE стриминг ──────────────────────────────────────
      const stream = this.client.messages.stream({
        model,
        max_tokens: 8096,
        tools: TOOLS as any,
        messages: currentMessages,
      });

      let stopReason: string | null = null;
      const accumulatedContent: any[] = [];
      let currentTextBlock = '';
      let currentTextBlockType = '';

      for await (const event of stream) {
        switch (event.type) {

          case 'content_block_start':
            if (event.content_block.type === 'text') {
              currentTextBlockType = 'text';
              currentTextBlock = '';
            } else if (event.content_block.type === 'tool_use') {
              currentTextBlockType = 'tool_use';
              // placeholder — будет заполнен через content_block_delta
              accumulatedContent.push({
                type: 'tool_use',
                id: event.content_block.id,
                name: event.content_block.name,
                input: '',
              });
            }
            break;

          case 'content_block_delta':
            if (event.delta.type === 'text_delta') {
              currentTextBlock += event.delta.text;
              yield event.delta.text;  // ← настоящий стриминг, побайтово
            } else if (event.delta.type === 'input_json_delta') {
              // накапливаем JSON инструмента
              const last = accumulatedContent[accumulatedContent.length - 1];
              if (last?.type === 'tool_use') {
                last.input += event.delta.partial_json;
              }
            }
            break;

          case 'content_block_stop':
            if (currentTextBlockType === 'text' && currentTextBlock) {
              accumulatedContent.push({ type: 'text', text: currentTextBlock });
              currentTextBlock = '';
            } else if (currentTextBlockType === 'tool_use') {
              // парсим накопленный JSON
              const last = accumulatedContent[accumulatedContent.length - 1];
              if (last?.type === 'tool_use' && typeof last.input === 'string') {
                try {
                  last.input = JSON.parse(last.input || '{}');
                } catch {
                  last.input = {};
                }
              }
            }
            currentTextBlockType = '';
            break;

          case 'message_delta':
            stopReason = event.delta.stop_reason ?? null;
            break;
        }
      }

      // ── если end_turn — выходим ──────────────────────────────────────
      if (stopReason === 'end_turn' || !stopReason) { break; }

      // ── если tool_use — выполняем инструменты ────────────────────────
      if (stopReason === 'tool_use') {
        const toolUseBlocks = accumulatedContent.filter(b => b.type === 'tool_use');
        const toolResults = [];

        for (const block of toolUseBlocks) {
          onToolCall?.(block.name, `Вызов: ${block.name}`);
          yield `\n🔧 *${block.name}*...\n`;

          const result = await executeTool(
            block.name,
            block.input as Record<string, string>,
            workspaceRoot,
            onConfirm
          );

          yield `${result}\n`;

          toolResults.push({
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: result,
          });
        }

        currentMessages = [
          ...currentMessages,
          { role: 'assistant' as const, content: accumulatedContent },
          { role: 'user' as const, content: toolResults },
        ];

        continue;
      }

      break;
    }
  }
}