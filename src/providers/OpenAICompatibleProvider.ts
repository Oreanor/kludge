import * as https from 'https';

type ApiMsg = { role: 'user' | 'assistant'; content: string };

export class OpenAICompatibleProvider {
  constructor(
    protected readonly apiKey: string,
    private readonly hostname: string,
    private readonly apiPath: string,
    private readonly name: string,
  ) {}

  async *stream(
    messages: ApiMsg[],
    modelId: string,
    systemPrompt: string,
    signal?: AbortSignal,
  ): AsyncIterable<string> {
    const body = JSON.stringify({
      model: modelId,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      stream: true,
      max_tokens: 4096,
    });

    const chunks: string[] = [];
    let notify: (() => void) | null = null;
    let finished = false;
    let streamError: Error | null = null;

    const req = https.request(
      {
        hostname: this.hostname,
        path: this.apiPath,
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
            streamError = new Error(`${this.name} ${res.statusCode}: ${errBody.slice(0, 200)}`);
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

    const abortHandler = () => { req.destroy(); finished = true; notify?.(); };
    signal?.addEventListener('abort', abortHandler, { once: true });

    req.on('error', (e: Error) => {
      if (!signal?.aborted) { streamError = e; }
      finished = true;
      notify?.();
    });
    req.write(body);
    req.end();

    while (true) {
      if (signal?.aborted) { break; }
      if (chunks.length > 0) { yield chunks.shift()!; continue; }
      if (streamError) { signal?.removeEventListener('abort', abortHandler); throw streamError; }
      if (finished) { break; }
      await new Promise<void>(r => { notify = r; });
      notify = null;
    }

    signal?.removeEventListener('abort', abortHandler);
    if (!signal?.aborted) {
      while (chunks.length > 0) { yield chunks.shift()!; }
    }
  }
}
