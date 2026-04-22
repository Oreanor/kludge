import * as http from 'http';
import * as net from 'net';

const BRIDGE_MARKER = '__air_bridge__';

export class ProxyService {
  private server?: http.Server;
  private port?: number;

  async start(targetUrl: string, bridgeScript: string): Promise<string> {
    await this.stop();

    const target = new URL(targetUrl);
    this.port = await findFreePort();

    this.server = http.createServer((req, res) => {
      this._proxy(req, res, target, bridgeScript);
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.listen(this.port, '127.0.0.1', resolve);
      this.server!.on('error', reject);
    });

    console.log(`[AIR] Proxy started on port ${this.port} → ${targetUrl}`);
    return `http://127.0.0.1:${this.port}`;
  }

  async stop(): Promise<void> {
    return new Promise(resolve => {
      if (!this.server) { resolve(); return; }
      this.server.close(() => { this.server = undefined; resolve(); });
    });
  }

  private _proxy(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    target: URL,
    bridgeScript: string
  ): void {
    const options: http.RequestOptions = {
      hostname: target.hostname,
      port: Number(target.port) || 80,
      path: req.url ?? '/',
      method: req.method,
      headers: {
        ...req.headers,
        host: target.host,
        'accept-encoding': 'identity', // disable gzip so we can inject without decompression
      },
    };

    const proxyReq = http.request(options, proxyRes => {
      const ct = proxyRes.headers['content-type'] ?? '';
      const isHtml = ct.includes('text/html');

      const headers: http.OutgoingHttpHeaders = { ...proxyRes.headers };
      // remove headers that break iframe embedding or block our injected script
      delete headers['content-security-policy'];
      delete headers['x-frame-options'];
      delete headers['content-length']; // length changes after injection

      if (!isHtml) {
        res.writeHead(proxyRes.statusCode!, headers);
        proxyRes.pipe(res);
        return;
      }

      let body = '';
      proxyRes.setEncoding('utf8');
      proxyRes.on('data', chunk => { body += chunk; });
      proxyRes.on('end', () => {
        const injected = injectBridge(body, bridgeScript);
        headers['content-type'] = 'text/html; charset=utf-8';
        res.writeHead(proxyRes.statusCode!, headers);
        res.end(injected);
      });
    });

    proxyReq.on('error', err => {
      if (!res.headersSent) {
        res.writeHead(502);
        res.end(`[AIR Proxy] ${err.message}`);
      }
    });

    req.pipe(proxyReq);
  }
}

function injectBridge(html: string, script: string): string {
  if (html.includes(BRIDGE_MARKER)) { return html; }
  const tag = `<script id="${BRIDGE_MARKER}">\n${script}\n</script>`;
  if (html.includes('</head>')) { return html.replace('</head>', `${tag}\n</head>`); }
  if (/<body[^>]*>/i.test(html)) { return html.replace(/<body[^>]*>/i, m => `${m}\n${tag}`); }
  return tag + html;
}

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address() as net.AddressInfo;
      srv.close(() => resolve(addr.port));
    });
    srv.on('error', reject);
  });
}
