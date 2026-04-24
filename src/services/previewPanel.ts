import * as vscode from 'vscode';
import * as net from 'net';
import { ProxyService } from './proxyService';
import { getBridgeScript } from '../utils/bridgeScript';
import { getPreviewShellHtml } from '../utils/previewShellHtml';

export interface ElementInfo {
  selector: string
  tagName: string
  innerHTML: string
  rect: { top: number; left: number; width: number; height: number }
  styles: Record<string, string>
}

export class PreviewPanel {
  private panel?: vscode.WebviewPanel;
  private onConsoleError?: (msg: string, stack: string) => void;
  private onElementPicked?: (info: ElementInfo) => void;
  private pendingInspect?: (data: ElementInfo | null) => void;
  private pendingScreenshot?: (base64: string | null) => void;
  private proxy = new ProxyService();

  async open(url?: string) {
    const targetUrl = url ?? await this._detectOrAsk();
    if (!targetUrl) { return; }

    // Start proxy so bridge script is injected into every HTML page load
    const proxyUrl = await this.proxy.start(targetUrl, getBridgeScript()).catch(err => {
      console.error('[Kludge] Proxy start failed, falling back to direct URL:', err);
      return targetUrl;
    });

    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
      this.panel.webview.postMessage({ type: 'shell:navigate', url: proxyUrl });
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'kludge.preview',
      'Kludge Preview',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [],
      }
    );

    this.panel.webview.html = this._getHtml(proxyUrl);
    this.panel.webview.onDidReceiveMessage(msg => this._handleBridgeMessage(msg));
    this.panel.onDidDispose(() => {
      this.panel = undefined;
      void this.proxy.stop();
    });
  }

  reload() {
    this.panel?.webview.postMessage({ type: 'shell:reload' });
  }

  startElementPicker() {
    if (!this.panel) {
      vscode.window.showWarningMessage('Сначала открой Preview (Kludge: Open Preview)');
      return;
    }
    this.panel.reveal(vscode.ViewColumn.Beside);
    this.panel.webview.postMessage({ type: 'shell:start_picker' });
    vscode.window.showInformationMessage('Kludge Picker: кликни на элемент в Preview →');
  }

  // ── остановить пикер из extension (команда kludge.stopPicker) ───────────
  stopElementPicker() {
    if (!this.panel) { return; }
    this.panel.webview.postMessage({ type: 'shell:stop_picker' });
  }

  inspectElement(selector: string): Promise<ElementInfo | null> {
    if (!this.panel) { return Promise.resolve(null); }
    return new Promise(resolve => {
      this.pendingInspect = resolve;
      this.panel!.webview.postMessage({ type: 'shell:inspect', selector });
      setTimeout(() => {
        if (this.pendingInspect) {
          this.pendingInspect = undefined;
          resolve(null);
        }
      }, 3000);
    });
  }

  screenshot(): Promise<string | null> {
    if (!this.panel) { return Promise.resolve(null); }
    return new Promise(resolve => {
      this.pendingScreenshot = resolve;
      this.panel!.webview.postMessage({ type: 'shell:screenshot' });
      setTimeout(() => {
        if (this.pendingScreenshot) {
          this.pendingScreenshot = undefined;
          resolve(null);
        }
      }, 5000);
    });
  }

  subscribeToErrors(cb: (msg: string, stack: string) => void) {
    this.onConsoleError = cb;
  }

  subscribeToElementPicks(cb: (info: ElementInfo) => void) {
    this.onElementPicked = cb;
  }

  get isOpen() {
    return !!this.panel;
  }

  private _handleBridgeMessage(msg: any) {
    switch (msg.type) {
      case 'bridge:console_error':
        this.onConsoleError?.(msg.message, msg.stack ?? '');
        break;

      case 'bridge:element_picked':
        if (this.pendingInspect) {
          this.pendingInspect(msg.data);
          this.pendingInspect = undefined;
        }
        if (msg.data) {
          this.onElementPicked?.(msg.data);
        }
        break;

      case 'bridge:inspect_result':
        if (this.pendingInspect) {
          this.pendingInspect(msg.data);
          this.pendingInspect = undefined;
        }
        break;

      case 'bridge:screenshot':
        if (this.pendingScreenshot) {
          this.pendingScreenshot(msg.data);
          this.pendingScreenshot = undefined;
        }
        break;
    }
  }

  private async _detectOrAsk(): Promise<string | undefined> {
    const candidates = [
      { port: 5173, label: 'Vite' },
      { port: 3000, label: 'React / Next.js' },
      { port: 4200, label: 'Angular' },
      { port: 8080, label: 'Vue CLI' },
      { port: 3001, label: 'CRA alt' },
    ];

    const results = await Promise.all(
      candidates.map(async c => ({ ...c, open: await isPortOpen(c.port) }))
    );
    const found = results.filter(c => c.open);

    if (found.length === 1) { return `http://localhost:${found[0].port}`; }

    if (found.length > 1) {
      const pick = await vscode.window.showQuickPick(
        found.map(f => ({ label: f.label, description: `http://localhost:${f.port}` }))
      );
      return pick?.description;
    }

    return vscode.window.showInputBox({
      prompt: 'URL для предпросмотра',
      value: 'http://localhost:3000',
      placeHolder: 'http://localhost:3000',
    });
  }

  private _getHtml(url: string): string {
    return getPreviewShellHtml(url);
  }
}

export { getBridgeScript } from '../utils/bridgeScript';

function isPortOpen(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = new net.Socket();
    socket.setTimeout(300);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => { socket.destroy(); resolve(false); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.connect(port, '127.0.0.1');
  });
}
