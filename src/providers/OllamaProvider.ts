import * as http from 'http';
import * as https from 'https';

export class OllamaProvider {
  private readonly base: URL;

  constructor(baseUrl: string) {
    this.base = new URL(baseUrl.replace(/\/$/, ''));
  }

  async fetchModels(): Promise<Array<{ id: string; label: string; provider: 'ollama' }>> {
    return new Promise(resolve => {
      const transport = this.base.protocol === 'https:' ? https : http;
      const req = transport.get(
        `${this.base.origin}/api/tags`,
        { headers: { 'Accept': 'application/json' } },
        (res) => {
          let body = '';
          res.on('data', (c: Buffer) => { body += c.toString(); });
          res.on('end', () => {
            try {
              const data = JSON.parse(body);
              resolve((data.models ?? []).map((m: any) => ({
                id: m.name as string,
                label: m.name as string,
                provider: 'ollama' as const,
              })));
            } catch { resolve([]); }
          });
        }
      );
      req.on('error', () => resolve([]));
    });
  }

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
    });

    const transport = this.base.protocol === 'https:' ? https : http;
    const chunks: string[] = [];
    let notify: (() => void) | null = null;
    let finished = false;
    let streamError: Error | null = null;

    const req = transport.request(
      {
        hostname: this.base.hostname,
        port: this.base.port || (this.base.protocol === 'https:' ? 443 : 80),
        path: '/api/chat',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        if ((res.statusCode ?? 200) >= 400) {
          let errBody = '';
          res.on('data', (c: Buffer) => { errBody += c.toString(); });
          res.on('end', () => {
            streamError = new Error(`Ollama ${res.statusCode}: ${errBody.slice(0, 200)}`);
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
            if (!line.trim()) { continue; }
            try {
              const parsed = JSON.parse(line);
              const content = parsed.message?.content;
              if (content) { chunks.push(content); notify?.(); }
              if (parsed.done) { finished = true; notify?.(); }
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
