import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ChatOrchestrator } from './services';
import { ChatRequest } from './types';
import { GitService } from './services/GitService';
import { NpmService } from './services/NpmService';

const SCAN_EXCLUDE = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'coverage',
  '.next', '.nuxt', '.cache', '__pycache__', '.vscode', '.idea',
]);

function scanFolders(
  root: string,
  rel: string,
  depth: number,
  maxDepth: number,
): Array<{ name: string; path: string; depth: number }> {
  if (depth > maxDepth) { return []; }
  const result: Array<{ name: string; path: string; depth: number }> = [];
  try {
    const entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory() || SCAN_EXCLUDE.has(e.name) || e.name.startsWith('.')) { continue; }
      const relPath = rel ? `${rel}/${e.name}` : e.name;
      result.push({ name: e.name, path: relPath, depth });
      result.push(...scanFolders(root, relPath, depth + 1, maxDepth));
    }
  } catch {}
  return result;
}

export class ChatProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = 'kludge.chatView';
  private _view?: vscode.WebviewView;
  private _abortController?: AbortController;
  private _messageQueue: any[] = [];
  private _readyResolve?: () => void;
  private _readyPromise: Promise<void> = new Promise(r => { this._readyResolve = r; });
  private _isReady = false;
  private _git?: GitService;
  private _npm?: NpmService;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly orchestrator?: ChatOrchestrator
  ) {}

  get isVisible(): boolean {
    return this._view?.visible ?? false;
  }

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    this._isReady = false;
    this._readyPromise = new Promise(r => { this._readyResolve = r; });

    const postMsg = (msg: unknown) => this._view?.webview.postMessage(msg);
    this._git = new GitService(postMsg, this.orchestrator);
    this._npm = new NpmService(postMsg);

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview')],
    };
    webviewView.webview.html = this._getHtml(webviewView.webview);

    const sendAll = () => {
      if (!webviewView.visible) { return; }
      this._sendLocale();
      this._sendHistory();
      this._sendModels();
      this._sendNpmScripts();
      this._sendWorkspaceTree();
      this._sendActiveFile();
      void this._git?.sendInfo(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '');
    };

    const activeEditorDisposable = vscode.window.onDidChangeActiveTextEditor(() => this._sendActiveFile());
    webviewView.onDidDispose(() => activeEditorDisposable.dispose());
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) { sendAll(); this._flushQueue(); }
    });

    webviewView.webview.onDidReceiveMessage(msg => {
      if (msg?.type === 'ready') {
        this._isReady = true;
        this._readyResolve?.();
        sendAll();
        this._flushQueue();
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

  private _flushQueue() {
    if (!this._view?.visible || this._messageQueue.length === 0) { return; }
    const queue = [...this._messageQueue];
    this._messageQueue = [];
    for (const msg of queue) { this._view.webview.postMessage(msg); }
  }

  private _sendLocale() {
    if (!this._view?.visible) { return; }
    this._view.webview.postMessage({ type: 'locale', locale: vscode.env.language });
  }

  private _sendHistory() {
    if (!this._view?.visible || !this.orchestrator) { return; }
    try {
      const hist = this.orchestrator.getHistory('default');
      if (Array.isArray(hist) && hist.length > 0) {
        this._view.webview.postMessage({ type: 'history', conversationId: 'default', messages: hist });
      }
    } catch (e) {
      console.error('[Kludge] ChatProvider: failed to send history', e);
    }
  }

  private _sendModels() {
    if (!this._view?.visible) { return; }
    const models = this.orchestrator?.getAvailableModels() ?? [];
    this._view.webview.postMessage({ type: 'models', models });
  }

  private _sendWorkspaceTree() {
    if (!this._view?.visible) { return; }
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!folder) {
      this._view.webview.postMessage({ type: 'workspace-tree', root: null, folders: [] });
      return;
    }
    const folders = scanFolders(folder, '', 0, 2);
    this._view.webview.postMessage({ type: 'workspace-tree', root: folder, folders });
  }

  private _sendActiveFile() {
    if (!this._view?.visible) { return; }
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const filePath = vscode.window.activeTextEditor?.document.uri.fsPath ?? null;
    let relativePath: string | null = null;
    if (filePath && folder) {
      const norm = filePath.replace(/\\/g, '/');
      const normFolder = folder.replace(/\\/g, '/');
      if (norm.startsWith(normFolder)) {
        relativePath = norm.slice(normFolder.length).replace(/^\//, '');
      }
    }
    this._view.webview.postMessage({ type: 'active-file', relativePath });
  }

  private _sendNpmScripts() {
    if (!this._view?.visible) { return; }
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!folder) { return; }
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(folder, 'package.json'), 'utf8'));
      const scripts: string[] = Object.keys(pkg.scripts ?? {});
      this._view.webview.postMessage({ type: 'npm-scripts', scripts });
    } catch {
      this._view.webview.postMessage({ type: 'npm-scripts', scripts: [] });
    }
  }

  private async _handleMessage(msg: any) {
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    try {
      switch (msg?.type) {

        case 'send': {
          this._abortController?.abort();
          this._abortController = new AbortController();
          const signal = this._abortController.signal;
          const payload = msg.payload ?? { text: msg.text };
          const request: ChatRequest = payload.text
            ? {
                conversationId: payload.conversationId ?? 'default',
                messages: [{ id: `user-${Date.now()}`, role: 'user', content: payload.text, createdAt: Date.now() }],
                context: payload.context ?? { taskKind: 'chat' },
                modelId: payload.modelId ?? 'default',
              } as ChatRequest
            : payload as ChatRequest;

          this._view?.webview.postMessage({ type: 'stream-start', conversationId: request.conversationId });

          if (this.orchestrator) {
            try {
              await this.orchestrator.streamChatResponse(request, delta => {
                if (!signal.aborted) { this._view?.webview.postMessage({ type: 'delta', delta }); }
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

        case 'stop':
          this._abortController?.abort();
          this._view?.webview.postMessage({ type: 'stopped' });
          break;

        case 'command':
          vscode.commands.executeCommand(msg.command);
          break;

        case 'git-info':
          if (folder) { await this._git?.sendInfo(folder); }
          break;

        case 'git-checkout':
          if (folder) { await this._git?.handleCheckout(msg.branch, msg.isNew, folder); }
          break;

        case 'git-add':
          if (folder) { await this._git?.handleAdd(folder); }
          break;

        case 'git-commit':
        case 'git-push':
          if (folder) { await this._git?.handleCommitOrPush(msg.type === 'git-push', folder); }
          break;

        case 'npm-scripts':
          this._sendNpmScripts();
          break;

        case 'npm-run':
          if (folder) { this._npm?.run(msg.script ?? '', folder); }
          break;

        case 'clear-history':
          await this.orchestrator?.clearHistory(msg.conversationId ?? 'default');
          break;
      }
    } catch (err) {
      this._view?.webview.postMessage({ type: 'error', error: String(err) });
    }
  }

  private _getHtml(webview: vscode.Webview): string {
    const distPath = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'webview');
    const htmlPath = path.join(distPath.fsPath, 'index.html');
    let html: string;
    try {
      html = fs.readFileSync(htmlPath, 'utf8');
    } catch (error) {
      return `<html><body>Error: Could not load index.html from ${htmlPath}. Please run 'npm run build'. Error: ${error}</body></html>`;
    }

    html = html.replace(/(src|href)="([^"]+)"/g, (_, attr, val) => {
      if (val.startsWith('http')) { return `${attr}="${val}"`; }
      const uri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', val));
      return `${attr}="${uri}"`;
    });

    const nonce = getNonce();
    html = html.replace('<head>', `<head>
      <meta http-equiv="Content-Security-Policy" content="
        default-src 'none';
        script-src 'nonce-${nonce}' 'unsafe-eval';
        style-src ${webview.cspSource} 'unsafe-inline';
        img-src ${webview.cspSource} data:;
        connect-src *;
      ">`);
    html = html.replace(/<script /g, `<script nonce="${nonce}" `);
    return html;
  }
}

function getNonce() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
