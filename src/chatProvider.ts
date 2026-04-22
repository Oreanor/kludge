import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as net from 'net';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { ChatOrchestrator } from './services';
import { ChatRequest } from './types';

const execFileP = promisify(execFile);

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileP('git', args, { cwd });
  return stdout.trim();
}

function isPortOpen(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = new net.Socket();
    socket.setTimeout(300);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error',   () => { socket.destroy(); resolve(false); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.connect(port, '127.0.0.1');
  });
}

function devPortCandidates(folder: string): number[] {
  // Пробуем вычитать порт из vite.config и package.json dev-скрипта
  const found: number[] = [];
  try {
    for (const name of ['vite.config.ts', 'vite.config.js', 'vite.config.mts']) {
      const cfg = fs.readFileSync(path.join(folder, name), 'utf8');
      const m = cfg.match(/port\s*:\s*(\d+)/);
      if (m) { found.push(parseInt(m[1])); break; }
    }
  } catch {}
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(folder, 'package.json'), 'utf8'));
    const m = (pkg.scripts?.dev ?? '').match(/--port[=\s]+(\d+)/);
    if (m) { found.push(parseInt(m[1])); }
  } catch {}
  return found.length ? found : [5173, 3000, 4200, 8080, 3001];
}

export class ChatProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'air.chatView';
  private _view?: vscode.WebviewView;

  // AbortController для остановки текущего стрима
  private _abortController?: AbortController;

  // ── очередь сообщений — копятся пока webview не готов/не видим ──────
  private _messageQueue: any[] = [];

  // ── промис который резолвится когда webview прислал 'ready' ──────────
  private _readyResolve?: () => void;
  private _readyPromise: Promise<void> = new Promise(r => { this._readyResolve = r; });
  private _isReady = false;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly orchestrator?: ChatOrchestrator
  ) {}

  get isVisible(): boolean {
    return this._view?.visible ?? false;
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;

    // При каждом пересоздании webview — сбрасываем ready-флаг
    this._isReady = false;
    this._readyPromise = new Promise(r => { this._readyResolve = r; });

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview')
      ],
    };

    webviewView.webview.html = this._getHtml(webviewView.webview);

    // ── отправляем историю ────────────────────────────────────────────────
    const sendHistory = () => {
      if (!webviewView.visible) { return; }
      if (this.orchestrator) {
        try {
          const hist = this.orchestrator.getHistory('default');
          if (Array.isArray(hist) && hist.length > 0) {
            this._view?.webview.postMessage({ type: 'history', conversationId: 'default', messages: hist });
          }
        } catch (e) {
          console.error('[air] ChatProvider: failed to send history', e);
        }
      }
    };

    // ── отправляем список доступных моделей ───────────────────────────────
    const sendModels = () => {
      if (!webviewView.visible) { return; }
      const models = this.orchestrator?.getAvailableModels() ?? [];
      this._view?.webview.postMessage({ type: 'models', models });
    };

    // ── отправляем npm-скрипты из package.json ────────────────────────────
    const sendNpmScripts = () => {
      if (!webviewView.visible) { return; }
      const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!folder) { return; }
      try {
        const pkgPath = path.join(folder, 'package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const scripts: string[] = Object.keys(pkg.scripts ?? {});
        this._view?.webview.postMessage({ type: 'npm-scripts', scripts });
      } catch {
        this._view?.webview.postMessage({ type: 'npm-scripts', scripts: [] });
      }
    };

    // ── сбрасываем очередь накопленных сообщений ─────────────────────────
    const flushQueue = () => {
      if (!webviewView.visible) { return; }
      if (this._messageQueue.length === 0) { return; }
      const queue = [...this._messageQueue];
      this._messageQueue = [];
      for (const msg of queue) {
        webviewView.webview.postMessage(msg);
      }
    };

    const sendGitInfo = async () => {
      if (!webviewView.visible) { return; }
      const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!folder) { return; }
      try {
        const [branch, branchList] = await Promise.all([
          git(['rev-parse', '--abbrev-ref', 'HEAD'], folder),
          git(['branch'], folder),
        ]);
        const branches = branchList.split('\n').map(b => b.replace(/^\*\s*/, '').trim()).filter(Boolean);
        this._view?.webview.postMessage({ type: 'git-info', branch, branches });
      } catch { /* не git-репо */ }
    };

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        sendHistory();
        sendModels();
        sendNpmScripts();
        void sendGitInfo();
        flushQueue();
      }
    });

    webviewView.webview.onDidReceiveMessage(msg => {
      if (msg?.type === 'ready') {
        this._isReady = true;
        this._readyResolve?.();
        sendHistory();
        sendModels();
        sendNpmScripts();
        void sendGitInfo();
        flushQueue();
        return;
      }
      void this._handleMessage(msg);
    });
  }

  public async postMessageWhenReady(msg: any, timeoutMs = 2000): Promise<void> {
    if (!this._isReady || !this._view?.visible) {
      vscode.commands.executeCommand(`${ChatProvider.viewId}.focus`).then(() => {}, () => {});
      await Promise.race([
        this._readyPromise,
        new Promise<void>(r => setTimeout(r, timeoutMs)),
      ]);
    }

    if (this._view?.visible) {
      this._view.webview.postMessage(msg);
    } else {
      this._messageQueue.push(msg);
    }
  }

  public postMessage(msg: any) {
    if (this._view?.visible) {
      this._view.webview.postMessage(msg);
    } else {
      this._messageQueue.push(msg);
      if (msg.type === 'user-message' || msg.type === 'stream-start') {
        vscode.commands.executeCommand(`${ChatProvider.viewId}.focus`).then(() => {}, () => {});
      }
    }
  }

  private async _handleMessage(msg: any) {
    try {
      switch (msg?.type) {

        case 'send': {
          // отменяем предыдущий стрим если был
          this._abortController?.abort();
          this._abortController = new AbortController();
          const signal = this._abortController.signal;

          const payload = msg.payload ?? { text: msg.text };

          let request: ChatRequest;
          if (payload && typeof payload.text === 'string') {
            request = {
              conversationId: payload.conversationId ?? 'default',
              messages: [
                { id: `user-${Date.now()}`, role: 'user', content: payload.text, createdAt: Date.now() }
              ],
              context: payload.context ?? { taskKind: 'chat' },
              modelId: payload.modelId ?? 'default',  // ← передаём выбранную модель
            } as ChatRequest;
          } else {
            request = payload as ChatRequest;
          }

          this._view?.webview.postMessage({ type: 'stream-start', conversationId: request.conversationId });

          if (this.orchestrator) {
            try {
              await this.orchestrator.streamChatResponse(request, (delta) => {
                if (signal.aborted) { return; }
                this._view?.webview.postMessage({ type: 'delta', delta });
              }, signal);

              if (!signal.aborted) {
                this._view?.webview.postMessage({ type: 'done', conversationId: request.conversationId });
              }
            } catch (e: any) {
              if (e?.name === 'AbortError' || signal.aborted) {
                this._view?.webview.postMessage({ type: 'stopped', conversationId: request.conversationId });
              } else {
                throw e;
              }
            }
          } else {
            this._view?.webview.postMessage({ type: 'response', text: `Echo: ${msg.text ?? JSON.stringify(msg.payload)}` });
          }
          break;
        }

        case 'stop': {
          this._abortController?.abort();
          this._view?.webview.postMessage({ type: 'stopped' });
          break;
        }

        case 'set-model-override': {
          break; // model selection handled by modelId in request payload
        }

        case 'command':
          vscode.commands.executeCommand(msg.command);
          break;

        case 'git-info': {
          const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
          if (!folder) { break; }
          try {
            const [branch, branchList] = await Promise.all([
              git(['rev-parse', '--abbrev-ref', 'HEAD'], folder),
              git(['branch'], folder),
            ]);
            const branches = branchList.split('\n').map(b => b.replace(/^\*\s*/, '').trim()).filter(Boolean);
            this._view?.webview.postMessage({ type: 'git-info', branch, branches });
          } catch { break; }
          break;
        }

        case 'git-checkout': {
          const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
          if (!folder) { break; }
          try {
            const args = msg.isNew
              ? ['checkout', '-b', msg.branch]
              : ['checkout', msg.branch];
            await git(args, folder);
            const [branch, branchList] = await Promise.all([
              git(['rev-parse', '--abbrev-ref', 'HEAD'], folder),
              git(['branch'], folder),
            ]);
            const branches = branchList.split('\n').map(b => b.replace(/^\*\s*/, '').trim()).filter(Boolean);
            this._view?.webview.postMessage({ type: 'git-info', branch, branches });
          } catch (e: any) {
            this._view?.webview.postMessage({ type: 'git-error', error: String(e.stderr ?? e.message ?? e) });
          }
          break;
        }

        case 'git-add': {
          const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
          if (!folder) { break; }
          this._view?.webview.postMessage({ type: 'git-busy', busy: true });
          try {
            await git(['add', '-A'], folder);
            this._view?.webview.postMessage({ type: 'git-op-done', op: 'add' });
          } catch (e: any) {
            this._view?.webview.postMessage({ type: 'git-error', error: String(e.stderr ?? e.message ?? e) });
          }
          this._view?.webview.postMessage({ type: 'git-busy', busy: false });
          break;
        }

        case 'git-commit':
        case 'git-push': {
          const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
          if (!folder) { break; }
          const isPush = msg.type === 'git-push';
          this._view?.webview.postMessage({ type: 'git-busy', busy: true });

          try {
            await git(['add', '-A'], folder);

            const staged = await git(['diff', '--cached', '--stat'], folder);

            if (staged) {
              // AI предлагает сообщение коммита
              let suggestion = '';
              if (this.orchestrator) {
                const diffNames = await git(['diff', '--cached', '--name-status'], folder).catch(() => staged);
                const req: ChatRequest = {
                  conversationId: '__git__',
                  messages: [{
                    id: `git-${Date.now()}`, role: 'user', createdAt: Date.now(),
                    content: `Напиши одну короткую строку — сообщение git-коммита (без кавычек, без точки в конце) для изменений:\n${diffNames}`,
                  }],
                  context: { taskKind: 'chat' },
                  modelId: 'auto',
                };
                await this.orchestrator.streamChatResponse(req, d => { suggestion += d; }).catch(() => {});
                suggestion = suggestion.trim().replace(/^["'`]|["'`]$/g, '');
              }

              const commitMsg = await vscode.window.showInputBox({
                prompt: 'Сообщение коммита',
                value: suggestion || undefined,
                placeHolder: 'Введите сообщение коммита',
                ignoreFocusOut: true,
              });

              if (commitMsg === undefined) {
                this._view?.webview.postMessage({ type: 'git-busy', busy: false });
                break;
              }

              await git(['commit', '-m', commitMsg], folder);
            }

            if (isPush) {
              try {
                await git(['push'], folder);
              } catch {
                const branch = await git(['rev-parse', '--abbrev-ref', 'HEAD'], folder);
                await git(['push', '-u', 'origin', branch], folder);
              }
            }

            this._view?.webview.postMessage({
              type: 'git-op-done',
              op: isPush ? 'push' : 'commit',
              commitMsg: staged ? commitMsg : undefined,
            });
          } catch (e: any) {
            this._view?.webview.postMessage({ type: 'git-error', error: String(e.stderr ?? e.message ?? e) });
          }
          this._view?.webview.postMessage({ type: 'git-busy', busy: false });
          break;
        }

        case 'npm-scripts': {
          const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
          if (!folder) { break; }
          try {
            const pkgPath = path.join(folder, 'package.json');
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            const scripts: string[] = Object.keys(pkg.scripts ?? {});
            this._view?.webview.postMessage({ type: 'npm-scripts', scripts });
          } catch {
            this._view?.webview.postMessage({ type: 'npm-scripts', scripts: [] });
          }
          break;
        }

        case 'npm-run': {
          const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
          if (!folder) { break; }
          const script: string = msg.script ?? '';
          const cmd = script === 'install' ? 'npm install' : `npm run ${script}`;
          let terminal = vscode.window.terminals.find(t => t.name === 'AIR: npm');
          if (!terminal || terminal.exitStatus !== undefined) {
            terminal = vscode.window.createTerminal({ name: 'AIR: npm', cwd: folder, shellPath: 'cmd.exe' });
          }
          terminal.show(true);
          terminal.sendText(cmd);

          // Для dev-сервера — ждём пока порт откроется, потом открываем превью
          if (script === 'dev') {
            const ports = devPortCandidates(folder);
            this._view?.webview.postMessage({ type: 'dev-polling', ports });

            const self = this;
            let attempts = 0;
            const check = async () => {
              if (attempts >= 60) {
                self._view?.webview.postMessage({ type: 'dev-polling-timeout' });
                return;
              }
              attempts++;
              for (const port of ports) {
                try {
                  if (await isPortOpen(port)) {
                    const url = `http://localhost:${port}`;
                    self._view?.webview.postMessage({ type: 'dev-server-ready', url });
                    await vscode.commands.executeCommand('air.openPreviewAt', url);
                    return;
                  }
                } catch (e) {
                  console.error('[AIR] isPortOpen error:', e);
                }
              }
              setTimeout(check, 1000);
            };
            setTimeout(check, 1000);
          }
          break;
        }

        case 'clear-history':
          await this.orchestrator?.clearHistory(msg.conversationId ?? 'default');
          break;

        default:
          break;
      }
    } catch (err) {
      this._view?.webview.postMessage({ type: 'error', error: String(err) });
    }
  }

  private _getHtml(webview: vscode.Webview): string {
    const distPath = vscode.Uri.joinPath(
      this._extensionUri, 'dist', 'webview', 'webview'
    );

    const htmlPath = path.join(distPath.fsPath, 'index.html');
    let html: string;
    try {
      html = fs.readFileSync(htmlPath, 'utf8');
    } catch (error) {
      return `<html><body>Error: Could not load index.html from ${htmlPath}. Please run 'npm run build'. Error: ${error}</body></html>`;
    }

    html = html.replace(
      /(src|href)="([^"]+)"/g,
      (_, attr, val) => {
        if (val.startsWith('http')) { return `${attr}="${val}"`; }
        const uri = webview.asWebviewUri(
          vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', val)
        );
        return `${attr}="${uri}"`;
      }
    );

    const nonce = getNonce();
    html = html.replace(
      '<head>',
      `<head>
        <meta http-equiv="Content-Security-Policy" content="
          default-src 'none';
          script-src 'nonce-${nonce}' 'unsafe-eval';
          style-src ${webview.cspSource} 'unsafe-inline';
          img-src ${webview.cspSource} data:;
          connect-src *;
        ">`
    );

    html = html.replace(/<script /g, `<script nonce="${nonce}" `);

    return html;
  }
}

function getNonce() {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}