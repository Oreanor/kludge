import * as https from 'https';

export const ANTHROPIC_CHAT_MODELS = [
  { id: 'claude-opus-4-6',           label: 'Claude Opus 4.6',    provider: 'anthropic' as const },
  { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6',  provider: 'anthropic' as const },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5',   provider: 'anthropic' as const },
];

export class AnthropicChatProvider {
  constructor(private readonly apiKey: string) {}

  async *stream(
    messages: { role: 'user' | 'assistant'; content: string }[],
    modelId: string,
    systemPrompt: string,
  ): AsyncIterable<string> {
    const body = JSON.stringify({
      model: modelId,
      max_tokens: 4096,
      stream: true,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });

    const chunks: string[] = [];
    let notify: (() => void) | null = null;
    let finished = false;
    let streamError: Error | null = null;

    const req = https.request(
      {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        if ((res.statusCode ?? 200) >= 400) {
          let errBody = '';
          res.on('data', (c: Buffer) => { errBody += c.toString(); });
          res.on('end', () => {
            streamError = new Error(`Anthropic ${res.statusCode}: ${errBody.slice(0, 200)}`);
            finished = true;
            notify?.();
          });
          return;
        }

        let buf = '';
        res.on('data', (chunk: Buffer) => {
          buf += chunk.toString('utf8');
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) { continue; }
            const data = line.slice(6).trim();
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                const text = parsed.delta.text;
                if (text) { chunks.push(text); notify?.(); }
              } else if (parsed.type === 'message_stop') {
                finished = true;
                notify?.();
              }
            } catch { /* skip malformed */ }
          }
        });
        res.on('end', () => { finished = true; notify?.(); });
        res.on('error', (e: Error) => { streamError = e; finished = true; notify?.(); });
      }
    );

    req.on('error', (e: Error) => { streamError = e; finished = true; notify?.(); });
    req.write(body);
    req.end();

    while (true) {
      if (chunks.length > 0) { yield chunks.shift()!; continue; }
      if (streamError) { throw streamError; }
      if (finished) { break; }
      await new Promise<void>(r => { notify = r; });
      notify = null;
    }
    while (chunks.length > 0) { yield chunks.shift()!; }
  }
}
