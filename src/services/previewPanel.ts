import * as vscode from 'vscode';
import * as net from 'net';

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
  private pendingInspect?: (data: ElementInfo) => void;
  private pendingScreenshot?: (base64: string) => void;

  // ── открыть / показать ────────────────────────────────────────────────

  async open(url?: string) {
    const targetUrl = url ?? await this._detectOrAsk();
    if (!targetUrl) {return;}

    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
      this.panel.webview.postMessage({ type: 'shell:navigate', url: targetUrl });
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'air.preview',
      'AIR Preview',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [],
      }
    );

    this.panel.webview.html = this._getHtml(targetUrl);

    this.panel.webview.onDidReceiveMessage(msg => {
      this._handleBridgeMessage(msg);
    });

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
  }

  reload() {
    this.panel?.webview.postMessage({ type: 'shell:reload' });
  }

  startElementPicker() {
    this.panel?.webview.postMessage({ type: 'shell:start_picker' });
  }

  // ── агентские методы ──────────────────────────────────────────────────

  inspectElement(selector: string): Promise<ElementInfo | null> {
    if (!this.panel) {return Promise.resolve(null);}
    return new Promise(resolve => {
      this.pendingInspect = resolve;
      this.panel!.webview.postMessage({ type: 'shell:inspect', selector });
      // таймаут на случай если элемент не найден
      setTimeout(() => resolve(null), 3000);
    });
  }

  screenshot(): Promise<string | null> {
    if (!this.panel) {return Promise.resolve(null);}
    return new Promise(resolve => {
      this.pendingScreenshot = resolve;
      this.panel!.webview.postMessage({ type: 'shell:screenshot' });
      setTimeout(() => resolve(null), 5000);
    });
  }

  subscribeToErrors(cb: (msg: string, stack: string) => void) {
    this.onConsoleError = cb;
  }

  // ── внутренняя обработка сообщений из iframe ──────────────────────────

  private _handleBridgeMessage(msg: any) {
    switch (msg.type) {
      case 'bridge:console_error':
        this.onConsoleError?.(msg.message, msg.stack ?? '');
        break;
      case 'bridge:element_picked':
      case 'bridge:inspect_result':
        this.pendingInspect?.(msg.data);
        this.pendingInspect = undefined;
        break;
      case 'bridge:screenshot':
        this.pendingScreenshot?.(msg.data);
        this.pendingScreenshot = undefined;
        break;
    }
  }

  // ── автодетект dev сервера ────────────────────────────────────────────

  private async _detectOrAsk(): Promise<string | undefined> {
    const candidates = [
      { port: 5173, label: 'Vite' },
      { port: 3000, label: 'React / Next.js' },
      { port: 4200, label: 'Angular' },
      { port: 8080, label: 'Vue CLI' },
      { port: 3001, label: 'CRA alt' },
    ];

    const found: typeof candidates = [];
    await Promise.all(
      candidates.map(c =>
        isPortOpen(c.port).then(open => { if (open) {found.push(c);} })
      )
    );

    if (found.length === 1) {
      return `http://localhost:${found[0].port}`;
    }

    if (found.length > 1) {
      const pick = await vscode.window.showQuickPick(
        found.map(f => ({
          label: f.label,
          description: `http://localhost:${f.port}`,
        }))
      );
      return pick?.description;
    }

    // ничего не нашли — спрашиваем вручную
    return vscode.window.showInputBox({
      prompt: 'URL для предпросмотра',
      value: 'http://localhost:3000',
      placeHolder: 'http://localhost:3000',
    });
  }

  // ── HTML оболочки с iframe ─────────────────────────────────────────────

  private _getHtml(url: string): string {
    // bridge.js — инжектируется в iframe через srcdoc прокси
    // здесь используем прямой iframe, bridge через postMessage
    const bridgeScript = getBridgeScript();

    return `<!DOCTYPE html>
<html style="height:100%">
<head>
  <meta http-equiv="Content-Security-Policy"
    content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;">
  <style>
    * { margin:0; padding:0; box-sizing:border-box }
    body {
      display:flex; flex-direction:column; height:100vh;
      background: var(--vscode-editor-background);
      color: var(--vscode-foreground);
      font-family: var(--vscode-font-family);
      font-size: 12px;
    }
    #toolbar {
      display:flex; align-items:center; gap:6px; padding:4px 8px;
      border-bottom:1px solid var(--vscode-panel-border);
      flex-shrink:0;
    }
    #url-bar {
      flex:1; background:var(--vscode-input-background);
      color:var(--vscode-input-foreground);
      border:1px solid var(--vscode-input-border);
      border-radius:3px; padding:2px 6px; font-size:11px;
    }
    button {
      background:var(--vscode-button-secondaryBackground);
      color:var(--vscode-button-secondaryForeground);
      border:none; padding:3px 8px; border-radius:3px;
      cursor:pointer; font-size:11px; white-space:nowrap;
    }
    button:hover { opacity:0.8 }
    button.active { background:var(--vscode-button-background);
                    color:var(--vscode-button-foreground) }
    #error-bar {
      display:none; padding:4px 8px; background:#5a1d1d;
      color:#f48771; font-size:11px; cursor:pointer;
      border-bottom:1px solid #f48771;
    }
    #frame { flex:1; border:none; width:100% }
  </style>
</head>
<body>
  <div id="toolbar">
    <button onclick="reload()" title="Reload">↺</button>
    <input id="url-bar" value="${url}" onkeydown="if(event.key==='Enter')navigate(this.value)"/>
    <button onclick="navigate(document.getElementById('url-bar').value)">Go</button>
    <button id="btn-picker" onclick="togglePicker()" title="Pick element">⊕ Pick</button>
    <button onclick="takeScreenshot()" title="Screenshot">⬡</button>
  </div>
  <div id="error-bar" onclick="this.style.display='none'"></div>
  <iframe id="frame" src="${url}"
    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals">
  </iframe>

  <script>
    const vscode = acquireVsCodeApi()
    const frame = document.getElementById('frame')
    const errorBar = document.getElementById('error-bar')
    let pickerActive = false

    // ── сообщения из iframe → extension ──────────────────────────────
    window.addEventListener('message', e => {
      if (e.source !== frame.contentWindow) return
      const msg = e.data
      if (!msg?.type) return

      // показываем ошибки в баре
      if (msg.type === 'bridge:console_error') {
        errorBar.textContent = '⚠ ' + msg.message
        errorBar.style.display = 'block'
      }

      // пробрасываем все bridge: сообщения в extension
      if (msg.type.startsWith('bridge:')) {
        vscode.postMessage(msg)
      }
    })

    // ── команды из extension → iframe ────────────────────────────────
    window.addEventListener('message', e => {
      if (e.source === frame.contentWindow) return
      const msg = e.data
      if (!msg?.type) return

      if (msg.type === 'shell:reload') reload()
      if (msg.type === 'shell:navigate') navigate(msg.url)
      if (msg.type === 'shell:start_picker') startPicker()
      if (msg.type === 'shell:inspect') {
        frame.contentWindow?.postMessage(msg, '*')
      }
      if (msg.type === 'shell:screenshot') {
        frame.contentWindow?.postMessage(msg, '*')
      }
    })

    function reload() {
      frame.src = frame.src
      errorBar.style.display = 'none'
    }

    function navigate(url) {
      frame.src = url
      document.getElementById('url-bar').value = url
    }

    function togglePicker() {
      pickerActive = !pickerActive
      document.getElementById('btn-picker').classList.toggle('active', pickerActive)
      frame.contentWindow?.postMessage(
        { type: pickerActive ? 'shell:start_picker' : 'shell:stop_picker' }, '*'
      )
    }

    function takeScreenshot() {
      frame.contentWindow?.postMessage({ type: 'shell:screenshot' }, '*')
    }

    // ── инжектируем bridge в iframe после загрузки ────────────────────
    frame.addEventListener('load', () => {
      try {
        const script = frame.contentDocument.createElement('script')
        script.textContent = ${JSON.stringify(bridgeScript)}
        frame.contentDocument.head.appendChild(script)
      } catch(e) {
        // CORS — bridge не инжектируется, это ок для внешних URL
      }
    })
  </script>
</body>
</html>`;
  }
}

// ── bridge скрипт — живёт внутри iframe ──────────────────────────────────

function getBridgeScript(): string {
  return `
(function() {
  if (window.__AIR_BRIDGE__) return
  window.__AIR_BRIDGE__ = true

  // перехват console.error
  const _err = console.error.bind(console)
  console.error = (...args) => {
    _err(...args)
    window.parent.postMessage({
      type: 'bridge:console_error',
      message: args.map(String).join(' '),
      stack: new Error().stack
    }, '*')
  }

  // перехват window.onerror
  window.addEventListener('error', e => {
    window.parent.postMessage({
      type: 'bridge:console_error',
      message: e.message,
      stack: e.filename + ':' + e.lineno
    }, '*')
  })

  // инспекция элемента по селектору
  function inspectEl(selector) {
    const el = document.querySelector(selector)
    if (!el) return null
    const s = window.getComputedStyle(el)
    const r = el.getBoundingClientRect()
    return {
      selector,
      tagName: el.tagName,
      innerHTML: el.innerHTML.slice(0, 300),
      rect: { top: r.top, left: r.left, width: r.width, height: r.height },
      styles: {
        color: s.color, background: s.backgroundColor,
        fontSize: s.fontSize, display: s.display,
        padding: s.padding, margin: s.margin,
        border: s.border, borderRadius: s.borderRadius,
      }
    }
  }

  // element picker
  let pickerOn = false
  let highlight = null

  function startPicker() {
    if (pickerOn) return
    pickerOn = true
    highlight = document.createElement('div')
    highlight.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;' +
      'border:2px solid #7F77DD;background:rgba(127,119,221,0.15);transition:all 0.05s'
    document.body.appendChild(highlight)
    document.addEventListener('mousemove', onMove)
    document.addEventListener('click', onPick, true)
  }

  function stopPicker() {
    pickerOn = false
    highlight?.remove()
    highlight = null
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('click', onPick, true)
  }

  function onMove(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY)
    if (!el || el === highlight) return
    const r = el.getBoundingClientRect()
    Object.assign(highlight.style, {
      top: r.top + 'px', left: r.left + 'px',
      width: r.width + 'px', height: r.height + 'px'
    })
  }

  function onPick(e) {
    e.preventDefault(); e.stopPropagation()
    const el = document.elementFromPoint(e.clientX, e.clientY)
    stopPicker()
    if (!el) return
    const sel = el.tagName.toLowerCase() +
      (el.id ? '#' + el.id : '') +
      (el.className && typeof el.className === 'string'
        ? '.' + el.className.trim().split(/\s+/)[0] : '')
    window.parent.postMessage({
      type: 'bridge:element_picked',
      data: inspectEl(sel)
    }, '*')
  }

  // screenshot через html2canvas если доступен, иначе сообщение
  async function takeScreenshot() {
    if (typeof html2canvas !== 'undefined') {
      const canvas = await html2canvas(document.body)
      window.parent.postMessage({
        type: 'bridge:screenshot',
        data: canvas.toDataURL('image/png')
      }, '*')
    } else {
      window.parent.postMessage({
        type: 'bridge:screenshot',
        data: null,
        error: 'html2canvas not available'
      }, '*')
    }
  }

  // слушаем команды из shell
  window.addEventListener('message', e => {
    const msg = e.data
    if (!msg?.type) return
    if (msg.type === 'shell:start_picker') startPicker()
    if (msg.type === 'shell:stop_picker') stopPicker()
    if (msg.type === 'shell:screenshot') takeScreenshot()
    if (msg.type === 'shell:inspect') {
      window.parent.postMessage({
        type: 'bridge:inspect_result',
        data: inspectEl(msg.selector)
      }, '*')
    }
  })
})()
`;
}

// ── утилита проверки порта ────────────────────────────────────────────────

function isPortOpen(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = new (require('net').Socket)();
    socket.setTimeout(300);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => { socket.destroy(); resolve(false); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.connect(port, '127.0.0.1');
  });
}