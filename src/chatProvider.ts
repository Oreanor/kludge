import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ChatOrchestrator } from './services';
import { ChatRequest, StoredSession, DisplayPair } from './types';
import {
  ACTIVE_SESSION_KEY, DISABLED_PROVIDERS_KEY, FILE_PATH_RE,
  MAX_DISPLAY_PAIRS, SESSIONS_KEY, TELEGRAM_CHAT_ID_KEY,
  TELEGRAM_SESSION_ID, TELEGRAM_TOKEN_KEY,
} from './constants';
import { GitService } from './services/GitService';
import { NpmService } from './services/NpmService';
import { TelegramService } from './services/telegramService';
import { SchedulerService } from './services/SchedulerService';
import { ProviderManager } from './services/ProviderManager';
import { scanFolders } from './utils/folderScanner';
import { getNonce } from './utils/nonce';
import { extractCmds, stripCmds, listWorkspaceFiles } from './utils/vscodeCmd';

function displayKey(sessionId: string) { return `kludge.display.${sessionId}`; }

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
  private _activeWork: { sessionId: string; sessionName: string; files: Set<string> } | null = null;
  private _telegram?: TelegramService;
  private _scheduler!: SchedulerService;
  private _providers!: ProviderManager;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _globalState: vscode.Memento,
    private readonly _secrets: vscode.SecretStorage,
    private readonly orchestrator?: ChatOrchestrator
  ) {
    this._scheduler = new SchedulerService(
      _globalState,
      text => this._sendScheduledPrompt(text),
      () => this._sendScheduledTasks(),
    );
    this._providers = new ProviderManager(
      _secrets,
      _globalState,
      orchestrator,
      msg => this._view?.webview.postMessage(msg),
    );
  }

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
      this._sendSessions();
      this._sendHistory();
      this._sendModels();
      this._sendNpmScripts();
      this._sendWorkspaceTree();
      this._sendActiveFile();
      this._sendCustomPrompts();
      this._sendScheduledTasks();
      void this._providers.sendProviders();
      void this._sendTelegramConfig();
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

  public async loadTelegramConfig(): Promise<void> {
    await this._initTelegram();
  }

  private async _initTelegram(): Promise<void> {
    this._telegram?.stopPolling();
    this._telegram = undefined;
    const token = await this._secrets.get(TELEGRAM_TOKEN_KEY);
    const chatId = this._globalState.get<string>(TELEGRAM_CHAT_ID_KEY, '');
    if (!token || !chatId) { return; }
    this._telegram = new TelegramService(token, chatId);
    this._telegram.startPolling((text, from) => this._handleTelegramIncoming(text, from));
  }

  private async _sendTelegramConfig(): Promise<void> {
    if (!this._view?.visible) { return; }
    const token = await this._secrets.get(TELEGRAM_TOKEN_KEY);
    const chatId = this._globalState.get<string>(TELEGRAM_CHAT_ID_KEY, '');
    this._view.webview.postMessage({ type: 'telegram-config', configured: !!(token && chatId), chatId: chatId ?? '' });
  }

  private async _handleTelegramIncoming(text: string, from: string): Promise<void> {
    this.postMessage({ type: 'user-message', text, from, source: 'telegram', conversationId: TELEGRAM_SESSION_ID });
    if (!this.orchestrator) { return; }

    const request: ChatRequest = {
      conversationId: TELEGRAM_SESSION_ID,
      messages: [{ id: `tg-${Date.now()}`, role: 'user', content: text, createdAt: Date.now() }],
      context: { taskKind: 'chat' },
      modelId: 'default',
    };

    this.postMessage({ type: 'stream-start', conversationId: TELEGRAM_SESSION_ID });
    try {
      let assembled = '';
      await this.orchestrator.streamChatResponse(request, delta => {
        assembled += delta;
        this.postMessage({ type: 'delta', delta, conversationId: TELEGRAM_SESSION_ID });
      });
      if (assembled) {
        const display = stripCmds(assembled) || assembled;
        await this._appendDisplayPair(TELEGRAM_SESSION_ID, text, display);
        this.postMessage({ type: 'done', conversationId: TELEGRAM_SESSION_ID });
        await this._telegram?.send(assembled);
      }
    } catch (e: any) {
      this.postMessage({ type: 'error', error: String(e), conversationId: TELEGRAM_SESSION_ID });
    }
  }

  private _sendHistory(conversationId?: string) {
    if (!this._view?.visible) { return; }
    const id = conversationId ?? this._globalState.get<string>(ACTIVE_SESSION_KEY, 'default');
    const pairs = this._globalState.get<DisplayPair[]>(displayKey(id), []);
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    for (const p of pairs) {
      messages.push({ role: 'user', content: p.user });
      messages.push({ role: 'assistant', content: p.assistant });
    }
    this._view.webview.postMessage({ type: 'history', conversationId: id, messages });
  }

  private async _appendDisplayPair(sessionId: string, user: string, assistant: string): Promise<void> {
    const pairs = this._globalState.get<DisplayPair[]>(displayKey(sessionId), []);
    await this._globalState.update(displayKey(sessionId), [...pairs, { user, assistant }].slice(-MAX_DISPLAY_PAIRS));
  }

  private async _clearDisplayHistory(sessionId: string): Promise<void> {
    await this._globalState.update(displayKey(sessionId), undefined);
  }

  private _getSessions(): StoredSession[] {
    const stored = this._globalState.get<StoredSession[]>(SESSIONS_KEY, []);
    if (stored.length === 0) {
      return [{ id: 'default', name: 'Chat 1', createdAt: Date.now() }];
    }
    return stored;
  }

  private async _saveSessions(sessions: StoredSession[]): Promise<void> {
    await this._globalState.update(SESSIONS_KEY, sessions);
  }

  private _sendSessions() {
    if (!this._view?.visible) { return; }
    const sessions = this._getSessions();
    const activeSessionId = this._globalState.get<string>(ACTIVE_SESSION_KEY, 'default');
    const busySessionId = this._activeWork?.sessionId ?? null;
    this._view.webview.postMessage({ type: 'sessions', sessions, activeSessionId, busySessionId });
  }

  private _sendModels() {
    if (!this._view?.visible) { return; }
    const models = this.orchestrator?.getAvailableModels() ?? [];
    const disabledProviders = this._providers.getDisabledProviders();
    this._view.webview.postMessage({ type: 'models', models, disabledProviders });
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

  private async _sendScheduledPrompt(text: string) {
    this._abortController?.abort();
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    await this.postMessageWhenReady({ type: 'user-message', text, from: 'Scheduled' });

    const request: ChatRequest = {
      conversationId: 'default',
      messages: [{ id: `user-${Date.now()}`, role: 'user', content: text, createdAt: Date.now() }],
      context: { taskKind: 'chat' },
      modelId: 'default',
      systemExtra: this._scheduler.getScheduledContext(),
    };

    this._view?.webview.postMessage({ type: 'stream-start', conversationId: 'default' });

    if (this.orchestrator) {
      try {
        let assembled = '';
        const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
        await this.orchestrator.streamChatResponse(request, delta => {
          assembled += delta;
          if (!signal.aborted) { this._view?.webview.postMessage({ type: 'delta', delta, conversationId: 'default' }); }
        }, signal);
        if (!signal.aborted) {
          await this._processAssembled(assembled, folder);
          await this._appendDisplayPair('default', text, stripCmds(assembled) || assembled);
          this._view?.webview.postMessage({ type: 'done', conversationId: 'default' });
        }
      } catch (e: any) {
        if (e?.name !== 'AbortError' && !signal.aborted) {
          this._view?.webview.postMessage({ type: 'error', error: String(e) });
        }
      }
    }
  }

  public async restoreScheduledTasks(): Promise<void> {
    await this._scheduler.restoreScheduledTasks();
  }

  private _sendScheduledTasks(): void {
    if (!this._view?.visible) { return; }
    this._view.webview.postMessage({ type: 'scheduled-tasks', tasks: this._scheduler.getTasks() });
  }

  public async loadProviderKeys(): Promise<void> {
    await this._providers.loadProviderKeys();
  }

  private async _takeSnapshot(ts: number): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!folder) { return; }
    const files: Array<{ path: string; content: string }> = [];
    for (const doc of vscode.workspace.textDocuments) {
      if (doc.uri.scheme !== 'file' || !doc.uri.fsPath.startsWith(folder)) { continue; }
      files.push({ path: doc.uri.fsPath, content: doc.getText() });
    }
    if (files.length === 0) { return; }
    const snapshots = this._globalState.get<Array<{ ts: number; files: typeof files }>>('kludge.snapshots', []);
    await this._globalState.update('kludge.snapshots', [...snapshots.slice(-14), { ts, files }]);
  }

  private async _restoreSnapshot(ts: number): Promise<void> {
    const snapshots = this._globalState.get<Array<{ ts: number; files: Array<{ path: string; content: string }> }>>('kludge.snapshots', []);
    const snap = snapshots.find(s => s.ts === ts);
    if (!snap || snap.files.length === 0) {
      vscode.window.showWarningMessage('Снапшот не найден — файлы не изменялись или история была очищена');
      return;
    }
    const choice = await vscode.window.showInformationMessage(
      `Восстановить ${snap.files.length} файл${snap.files.length === 1 ? '' : snap.files.length < 5 ? 'а' : 'ов'} до состояния перед этим запросом?`,
      { modal: true }, 'Восстановить', 'Отмена',
    );
    if (choice !== 'Восстановить') { return; }
    let count = 0;
    for (const file of snap.files) {
      try {
        await vscode.workspace.fs.writeFile(vscode.Uri.file(file.path), Buffer.from(file.content, 'utf8'));
        count++;
      } catch {}
    }
    vscode.window.showInformationMessage(`Восстановлено ${count} файлов`);
  }

  private async _executeVscodeCmd(cmd: Record<string, any>, folder: string): Promise<void> {
    switch (cmd.type) {
      case 'git-add':    await this._git?.handleAdd(folder); break;
      case 'git-commit': await this._git?.handleCommitOrPush(false, folder); break;
      case 'git-push':   await this._git?.handleCommitOrPush(true, folder); break;
      case 'npm-run':    this._npm?.run(String(cmd.script ?? ''), folder); break;
    }
  }

  private async _processAssembled(assembled: string, folder: string): Promise<void> {
    const cmds = extractCmds(assembled);
    if (cmds.length === 0) { return; }
    this._view?.webview.postMessage({ type: 'patch-last-message', text: stripCmds(assembled) });
    for (const cmd of cmds) { await this._executeVscodeCmd(cmd, folder); }
  }

  private async executeVscodeCmds(cmds: Array<Record<string, any>>, folder: string): Promise<void> {
    for (const cmd of cmds) { await this._executeVscodeCmd(cmd, folder); }
  }

  private _sendCustomPrompts() {
    if (!this._view?.visible) { return; }
    const cfg = vscode.workspace.getConfiguration('kludge');
    const saved = cfg.get<Array<{ label: string; text: string }>>('customPrompts', []);
    const prompts = saved.map((p, i) => ({ key: `custom-${i}`, label: p.label, text: p.text }));
    this._view.webview.postMessage({ type: 'custom-prompts', prompts });
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
          if (msg.snapshotTs) { void this._takeSnapshot(Number(msg.snapshotTs)); }
          this._abortController?.abort();
          this._abortController = new AbortController();
          const signal = this._abortController.signal;
          const payload = msg.payload ?? { text: msg.text };
          const sessionId = payload.conversationId ?? 'default';
          const workspaceFiles = await listWorkspaceFiles();

          if (this._activeWork && this._activeWork.sessionId !== sessionId) {
            const overlap = payload.context?.activeFile
              ? this._activeWork.files.has(payload.context.activeFile)
              : false;
            this._view?.webview.postMessage({
              type: 'session-busy',
              workingSession: { id: this._activeWork.sessionId, name: this._activeWork.sessionName },
              hasFileConflict: overlap,
            });
          }

          const sessions = this._getSessions();
          const session = sessions.find(s => s.id === sessionId);
          const touchedFiles = new Set<string>(
            [payload.context?.activeFile].filter(Boolean) as string[]
          );
          this._activeWork = { sessionId, sessionName: session?.name ?? sessionId, files: touchedFiles };
          this._sendSessions();

          const request: ChatRequest = payload.text
            ? {
                conversationId: sessionId,
                messages: [{ id: `user-${Date.now()}`, role: 'user', content: payload.text, createdAt: Date.now() }],
                context: { ...(payload.context ?? { taskKind: 'chat' }), workspaceFiles },
                modelId: payload.modelId ?? 'default',
                systemExtra: this._scheduler.getScheduledContext(),
              } as ChatRequest
            : { ...(payload as ChatRequest), context: { ...(payload as ChatRequest).context, workspaceFiles }, systemExtra: this._scheduler.getScheduledContext() };

          this._view?.webview.postMessage({ type: 'stream-start', conversationId: request.conversationId });

          if (sessionId === TELEGRAM_SESSION_ID && this._telegram) {
            const userText = request.messages?.at(-1)?.content ?? '';
            if (userText) { void this._telegram.send(`👤 ${userText}`); }
          }

          if (this.orchestrator) {
            try {
              let assembled = '';
              const userText = request.messages?.at(-1)?.content ?? '';
              await this.orchestrator.streamChatResponse(request, delta => {
                assembled += delta;
                if (!signal.aborted) {
                  let m: RegExpExecArray | null;
                  FILE_PATH_RE.lastIndex = 0;
                  while ((m = FILE_PATH_RE.exec(delta)) !== null) {
                    this._activeWork?.files.add(m[1]);
                  }
                  this._view?.webview.postMessage({ type: 'delta', delta, conversationId: request.conversationId });
                }
              }, signal);
              if (!signal.aborted) {
                await this._processAssembled(assembled, folder ?? '');
                await this._appendDisplayPair(sessionId, userText, stripCmds(assembled) || assembled);
                this._view?.webview.postMessage({ type: 'done', conversationId: request.conversationId });
                if (sessionId === TELEGRAM_SESSION_ID && this._telegram && assembled) {
                  await this._telegram.send(assembled);
                }
              }
            } catch (e: any) {
              if (e?.name === 'AbortError' || signal.aborted) {
                this._view?.webview.postMessage({ type: 'stopped', conversationId: request.conversationId });
              } else {
                throw e;
              }
            } finally {
              if (this._activeWork?.sessionId === sessionId) {
                this._activeWork = null;
                this._sendSessions();
              }
            }
          } else {
            this._activeWork = null;
            this._view?.webview.postMessage({ type: 'response', text: `Echo: ${msg.text ?? JSON.stringify(msg.payload)}` });
          }
          break;
        }

        case 'stop':
          this._abortController?.abort();
          this._view?.webview.postMessage({ type: 'stopped' });
          break;

        case 'new-session': {
          const sessions = this._getSessions();
          const num = sessions.length + 1;
          const newSession: StoredSession = { id: `s-${Date.now()}`, name: `Chat ${num}`, createdAt: Date.now() };
          await this._saveSessions([...sessions, newSession]);
          await this._globalState.update(ACTIVE_SESSION_KEY, newSession.id);
          this._sendSessions();
          this._sendHistory(newSession.id);
          break;
        }

        case 'switch-session': {
          const sid = String(msg.sessionId ?? 'default');
          if (sid !== TELEGRAM_SESSION_ID) {
            await this._globalState.update(ACTIVE_SESSION_KEY, sid);
            this._sendSessions();
          }
          this._sendHistory(sid);
          break;
        }

        case 'close-session': {
          const sid = String(msg.sessionId ?? '');
          if (!sid || sid === 'default') { break; }
          const sessions = this._getSessions().filter(s => s.id !== sid);
          if (sessions.length === 0) { break; }
          await this._saveSessions(sessions);
          const currentActive = this._globalState.get<string>(ACTIVE_SESSION_KEY, 'default');
          const nextActive = currentActive === sid ? sessions[sessions.length - 1].id : currentActive;
          await this._globalState.update(ACTIVE_SESSION_KEY, nextActive);
          await this.orchestrator?.clearHistory(sid);
          await this._clearDisplayHistory(sid);
          this._sendSessions();
          if (currentActive === sid) { this._sendHistory(nextActive); }
          break;
        }

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

        case 'git-init':
          if (folder) { await this._git?.handleInit(folder); }
          break;

        case 'git-reset-prev':
          if (folder) { await this._git?.handleResetPrev(folder); }
          break;

        case 'git-reset-remote':
          if (folder) { await this._git?.handleResetRemote(folder); }
          break;

        case 'npm-scripts':
          this._sendNpmScripts();
          break;

        case 'npm-run':
          if (folder) { this._npm?.run(msg.script ?? '', folder); }
          break;

        case 'clear-history': {
          const cid = msg.conversationId ?? this._globalState.get<string>(ACTIVE_SESSION_KEY, 'default');
          await this.orchestrator?.clearHistory(cid);
          await this._clearDisplayHistory(cid);
          break;
        }

        case 'schedule-prompt': {
          const task = {
            id: `task-${Date.now()}`,
            text: String(msg.text ?? ''),
            scheduledAt: Number(msg.scheduledAt),
          };
          await this._scheduler.saveTask(task);
          this._scheduler.armTask(task);
          break;
        }

        case 'cancel-scheduled-task':
          await this._scheduler.removeTask(String(msg.id ?? ''));
          break;

        case 'save-provider-key': {
          const pid = String(msg.providerId ?? '');
          if (!pid || !msg.key) { break; }
          await this._providers.saveKey(pid, String(msg.key));
          await this._providers.sendProviders();
          this._sendModels();
          break;
        }

        case 'remove-provider-key': {
          const pid = String(msg.providerId ?? '');
          if (!pid) { break; }
          this._providers.removeKey(pid);
          await this._providers.sendProviders();
          this._sendModels();
          break;
        }

        case 'restore-provider-key': {
          const pid = String(msg.providerId ?? '');
          if (!pid) { break; }
          await this._providers.restoreKey(pid);
          await this._providers.sendProviders();
          this._sendModels();
          break;
        }

        case 'toggle-provider': {
          const pid = String(msg.providerId ?? '');
          if (!pid) { break; }
          await this._providers.toggleDisabled(pid);
          this._sendModels();
          await this._providers.sendProviders();
          break;
        }

        case 'save-telegram-config': {
          const token = String(msg.token ?? '').trim();
          const chatId = String(msg.chatId ?? '').trim();
          if (token) { await this._secrets.store(TELEGRAM_TOKEN_KEY, token); }
          if (chatId) { await this._globalState.update(TELEGRAM_CHAT_ID_KEY, chatId); }
          await this._initTelegram();
          await this._sendTelegramConfig();
          break;
        }

        case 'restore-snapshot':
          await this._restoreSnapshot(Number(msg.ts));
          break;

        case 'save-custom-prompt': {
          const cfg = vscode.workspace.getConfiguration('kludge');
          const existing = cfg.get<Array<{ label: string; text: string }>>('customPrompts', []);
          await cfg.update('customPrompts', [...existing, { label: String(msg.label ?? ''), text: String(msg.text ?? '') }], vscode.ConfigurationTarget.Global);
          this._sendCustomPrompts();
          break;
        }
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
