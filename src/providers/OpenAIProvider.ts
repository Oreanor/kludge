import * as https from 'https';

export const OPENAI_MODELS = [
  { id: 'gpt-4o',       label: 'GPT-4o',       provider: 'openai' as const },
  { id: 'gpt-4o-mini',  label: 'GPT-4o mini',  provider: 'openai' as const },
  { id: 'o3-mini',      label: 'o3 mini',       provider: 'openai' as const },
  { id: 'o1-mini',      label: 'o1 mini',       provider: 'openai' as const },
];

export class OpenAIProvider {
  constructor(private readonly apiKey: string) {}

  async *stream(
    messages: { role: 'user' | 'assistant'; content: string }[],
    modelId: string,
    systemPrompt: string,
  ): AsyncIterable<string> {
    const body = JSON.stringify({
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content })),
      ],
      stream: true,
      max_tokens: 4096,
    });

    const chunks: string[] = [];
    let notify: (() => void) | null = null;
    let finished = false;
    let streamError: Error | null = null;

    const req = https.request(
      {
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        if ((res.statusCode ?? 200) >= 400) {
          let errBody = '';
          res.on('data', (c: Buffer) => { errBody += c.toString(); });
          res.on('end', () => {
            streamError = new Error(`OpenAI ${res.statusCode}: ${errBody.slice(0, 200)}`);
            finished = true; notify?.();
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
            if (data === '[DONE]') { finished = true; notify?.(); return; }
            try {
              const delta = JSON.parse(data).choices?.[0]?.delta?.content;
              if (delta) { chunks.push(delta); notify?.(); }
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
