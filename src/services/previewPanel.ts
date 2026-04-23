import * as vscode from 'vscode';
import * as net from 'net';
import { ProxyService } from './proxyService';

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
    return `<!DOCTYPE html>
<html style="height:100%">
<head>
  <meta http-equiv="Content-Security-Policy"
    content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;">
  <style>
    * { margin:0; padding:0; box-sizing:border-box }
    body {
      display:flex; flex-direction:column; height:100vh;
      background:var(--vscode-editor-background);
      color:var(--vscode-foreground);
      font-family:var(--vscode-font-family);
      font-size:12px;
    }
    #toolbar {
      display:flex; align-items:center; gap:6px; padding:4px 8px;
      border-bottom:1px solid var(--vscode-panel-border); flex-shrink:0;
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
    button.active {
      background:#7F77DD;
      color:#fff;
      outline:1px solid #7F77DD;
    }
    #error-bar {
      display:none; padding:4px 8px; background:#5a1d1d;
      color:#f48771; font-size:11px; cursor:pointer;
      border-bottom:1px solid #f48771;
    }
    #pick-result {
      display:none; padding:4px 8px; font-size:11px;
      background:var(--vscode-editor-inactiveSelectionBackground);
      border-bottom:1px solid var(--vscode-panel-border);
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    }
    #frame-wrap {
      flex:1; position:relative; overflow:hidden;
    }
    #frame { 
      position:absolute; inset:0;
      border:none; width:100%; height:100%;
    }
    /* Прозрачный оверлей для перехвата кликов в режиме picker */
    #picker-overlay {
      display:none;
      position:absolute; inset:0;
      z-index:10;
      cursor:crosshair;
    }
    #picker-overlay.active {
      display:block;
    }
    /* Хинт сверху */
    #picker-hint {
      display:none;
      position:absolute; top:0; left:0; right:0;
      z-index:11;
      background: rgba(127,119,221,0.92);
      color:#fff;
      text-align:center;
      padding:6px;
      font-size:12px;
      pointer-events:none;
    }
    #picker-hint.active { display:block; }
    /* Статус cross-origin */
    #crossorigin-bar {
      display:none; padding:4px 8px; background:#3a2a00;
      color:#ffcc00; font-size:11px;
      border-bottom:1px solid #ffcc00;
    }
  </style>
</head>
<body>
  <div id="toolbar">
    <button onclick="reload()" title="Перезагрузить">↺</button>
    <input id="url-bar" value="${url}"
      onkeydown="if(event.key==='Enter')navigate(this.value)"/>
    <button onclick="navigate(document.getElementById('url-bar').value)">Go</button>
    <button id="btn-picker" onclick="togglePicker()" title="Выбрать элемент">⊕ Pick</button>
    <button onclick="takeScreenshot()" title="Скриншот">⬡</button>
  </div>
  <div id="error-bar" onclick="this.style.display='none'"></div>
  <div id="crossorigin-bar">⚠ Bridge не ответил — пикер в режиме только координат. Убедись что dev-сервер запущен и proxy может его достичь.</div>
  <div id="pick-result"></div>

  <div id="frame-wrap">
    <div id="picker-hint">🎯 Кликни на элемент в preview &nbsp;·&nbsp; ESC — отмена</div>
    <!-- Оверлей перехватывает клики вместо iframe в режиме picker (cross-origin fallback) -->
    <div id="picker-overlay"></div>
    <iframe id="frame" src="${url}"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals">
    </iframe>
  </div>

  <script>
    const vscode = acquireVsCodeApi()
    const frame = document.getElementById('frame')
    const errorBar = document.getElementById('error-bar')
    const crossoriginBar = document.getElementById('crossorigin-bar')
    const pickResult = document.getElementById('pick-result')
    const overlay = document.getElementById('picker-overlay')
    const hint = document.getElementById('picker-hint')
    let pickerActive = false
    let bridgeReady = false
    let bridgeReadyTimer = null

    // bridge:ready arrives BEFORE iframe load event (bridge runs inline in <head>).
    // So we must NOT reset bridgeReady inside load — only reset it on explicit navigation.
    frame.addEventListener('load', () => {
      crossoriginBar.style.display = 'none'
      clearTimeout(bridgeReadyTimer)
      if (!bridgeReady) {
        // Bridge hasn't signalled yet — give it 3s before showing warning
        bridgeReadyTimer = setTimeout(() => {
          if (!bridgeReady) { crossoriginBar.style.display = 'block' }
        }, 3000)
      }
    })

    // ── из iframe → shell → extension ────────────────────────────────
    window.addEventListener('message', e => {
      if (e.source !== frame.contentWindow) return
      const msg = e.data
      if (!msg?.type) return

      if (msg.type === 'bridge:ready') {
        bridgeReady = true
        crossoriginBar.style.display = 'none'
        clearTimeout(bridgeReadyTimer)
        if (pickerActive) {
          // Picker was activated while bridge wasn't ready (overlay mode).
          // Switch to proper bridge mode: hide overlay, activate bridge picker.
          overlay.classList.remove('active')
          overlay.onclick = null
          hint.textContent = '🎯 Кликни на элемент в preview · ESC — отмена'
          frame.contentWindow?.postMessage({ type: 'shell:start_picker' }, '*')
        }
        return
      }

      if (msg.type === 'bridge:console_error') {
        errorBar.textContent = '⚠ ' + msg.message
        errorBar.style.display = 'block'
      }

      if (msg.type === 'bridge:element_picked' && msg.data) {
        showPickResult(msg.data)
        stopPickerUI()
      }

      if (msg.type.startsWith('bridge:')) {
        vscode.postMessage(msg)
      }
    })

    // ── из extension → shell ──────────────────────────────────────────
    window.addEventListener('message', e => {
      if (e.source === frame.contentWindow) return
      const msg = e.data
      if (!msg?.type) return
      if (msg.type === 'shell:reload') reload()
      if (msg.type === 'shell:navigate') navigate(msg.url)
      if (msg.type === 'shell:start_picker') activatePicker()
      if (msg.type === 'shell:stop_picker') {
        stopPickerUI()
        if (bridgeReady) {
          frame.contentWindow?.postMessage({ type: 'shell:stop_picker' }, '*')
        }
      }
      if (msg.type === 'shell:inspect' || msg.type === 'shell:screenshot') {
        frame.contentWindow?.postMessage(msg, '*')
      }
    })

    function reload() {
      bridgeReady = false
      errorBar.style.display = 'none'
      frame.src = frame.src
    }

    function navigate(url) {
      bridgeReady = false
      frame.src = url
      document.getElementById('url-bar').value = url
    }

    function togglePicker() {
      if (pickerActive) {
        stopPickerUI()
        if (bridgeReady) {
          frame.contentWindow?.postMessage({ type: 'shell:stop_picker' }, '*')
        }
        // сообщаем extension что пикер отменён (чтобы кнопка в чате деактивировалась)
        vscode.postMessage({ type: 'bridge:element_picked', data: null })
      } else {
        activatePicker()
      }
    }

    function activatePicker() {
      pickerActive = true
      document.getElementById('btn-picker').classList.add('active')

      if (bridgeReady) {
        // ── same-origin: bridge работает ─────────────────────────────
        overlay.classList.remove('active')
        hint.classList.add('active')
        frame.contentWindow?.postMessage({ type: 'shell:start_picker' }, '*')
      } else {
        // ── cross-origin: bridge недоступен, используем overlay ──────
        overlay.classList.add('active')
        hint.classList.add('active')
        hint.textContent = '⚠ Cross-origin: кликни — получим координаты · ESC — отмена'
        overlay.onclick = onOverlayClick
      }

      document.addEventListener('keydown', onEscKey)
    }

    function stopPickerUI() {
      pickerActive = false
      document.getElementById('btn-picker').classList.remove('active')
      overlay.classList.remove('active')
      hint.classList.remove('active')
      hint.textContent = '🎯 Кликни на элемент в preview · ESC — отмена'
      overlay.onclick = null
      document.removeEventListener('keydown', onEscKey)
    }

    function onEscKey(e) {
      if (e.key === 'Escape') {
        stopPickerUI()
        if (bridgeReady) {
          frame.contentWindow?.postMessage({ type: 'shell:stop_picker' }, '*')
        }
        // сообщаем extension — пикер отменён
        vscode.postMessage({ type: 'bridge:element_picked', data: null })
      }
    }

    // cross-origin fallback: получаем координаты клика в оверлее
    function onOverlayClick(e) {
      const rect = overlay.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const data = {
        selector: 'unknown (cross-origin)',
        tagName: 'UNKNOWN',
        innerHTML: '',
        rect: { top: Math.round(y), left: Math.round(x), width: 0, height: 0 },
        styles: { color: '', background: '', fontSize: '', fontWeight: '',
                  display: '', padding: '', margin: '', border: '',
                  borderRadius: '', width: '', height: '' },
        crossOrigin: true,
      }
      vscode.postMessage({ type: 'bridge:element_picked', data })
      showPickResult(data)
      stopPickerUI()
    }

    function showPickResult(d) {
      if (!d) return
      const label = d.crossOrigin
        ? '⚠ cross-origin: координаты ' + d.rect.left + ',' + d.rect.top
        : '⊕ ' + d.selector + ' — ' + d.rect.width + '×' + d.rect.height + ' — ' + d.styles.fontSize + ' ' + d.styles.color
      pickResult.textContent = label
      pickResult.style.display = 'block'
    }

    function takeScreenshot() {
      frame.contentWindow?.postMessage({ type: 'shell:screenshot' }, '*')
    }
  </script>
</body>
</html>`;
  }
}

export function getBridgeScript(): string {
  return `
(function() {
  if (window.__KLUDGE_BRIDGE__) return
  window.__KLUDGE_BRIDGE__ = true

  // ── перехват console.error ────────────────────────────────────────────
  const _err = console.error.bind(console)
  console.error = (...args) => {
    _err(...args)
    window.parent.postMessage({
      type: 'bridge:console_error',
      message: args.map(String).join(' '),
      stack: new Error().stack
    }, '*')
  }

  window.addEventListener('error', e => {
    window.parent.postMessage({
      type: 'bridge:console_error',
      message: e.message,
      stack: e.filename + ':' + e.lineno
    }, '*')
  })

  // ── inspect helper ────────────────────────────────────────────────────
  function inspectEl(el) {
    if (!el) return null
    const s = window.getComputedStyle(el)
    const r = el.getBoundingClientRect()
    let sel = el.tagName.toLowerCase()
    if (el.id) sel += '#' + el.id
    else if (el.className && typeof el.className === 'string' && el.className.trim()) {
      sel += '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.')
    }
    return {
      selector: sel,
      tagName: el.tagName,
      innerHTML: el.innerHTML.slice(0, 300),
      rect: {
        top: Math.round(r.top), left: Math.round(r.left),
        width: Math.round(r.width), height: Math.round(r.height)
      },
      styles: {
        color: s.color,
        background: s.backgroundColor,
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        display: s.display,
        padding: s.padding,
        margin: s.margin,
        border: s.border,
        borderRadius: s.borderRadius,
        width: s.width,
        height: s.height,
      }
    }
  }

  // ── picker ────────────────────────────────────────────────────────────
  let pickerOn = false
  let highlight = null
  let lastEl = null

  function startPicker() {
    if (pickerOn) return
    pickerOn = true

    highlight = document.createElement('div')
    highlight.setAttribute('data-air', 'highlight')
    highlight.style.cssText =
      'position:fixed;pointer-events:none;z-index:2147483647;' +
      'border:2px solid #7F77DD;background:rgba(127,119,221,0.15);' +
      'border-radius:2px;transition:top 0.05s,left 0.05s,width 0.05s,height 0.05s;' +
      'box-sizing:border-box;'
    document.body.appendChild(highlight)

    // Tooltip с именем элемента
    const tooltip = document.createElement('div')
    tooltip.setAttribute('data-air', 'tooltip')
    tooltip.style.cssText =
      'position:fixed;pointer-events:none;z-index:2147483648;' +
      'background:#7F77DD;color:#fff;font-size:11px;padding:2px 6px;' +
      'border-radius:3px;white-space:nowrap;font-family:monospace;'
    document.body.appendChild(tooltip)

    document.addEventListener('mouseover', onOver, true)
    document.addEventListener('mouseout', onOut, true)
    document.addEventListener('click', onPick, true)
    document.addEventListener('keydown', onEsc, true)
    document.body.style.cursor = 'crosshair'
  }

  function stopPicker() {
    if (!pickerOn) return
    pickerOn = false
    highlight?.remove()
    highlight = null
    document.querySelector('[data-air="tooltip"]')?.remove()
    lastEl = null
    document.removeEventListener('mouseover', onOver, true)
    document.removeEventListener('mouseout', onOut, true)
    document.removeEventListener('click', onPick, true)
    document.removeEventListener('keydown', onEsc, true)
    document.body.style.cursor = ''
  }

  function onEsc(e) {
    if (e.key === 'Escape') {
      stopPicker()
      window.parent.postMessage({ type: 'bridge:picker_cancelled' }, '*')
    }
  }

  function onOver(e) {
    const el = e.target
    if (!el || el.getAttribute?.('data-air')) return
    lastEl = el
    const r = el.getBoundingClientRect()
    if (highlight) {
      Object.assign(highlight.style, {
        top: r.top + 'px', left: r.left + 'px',
        width: r.width + 'px', height: r.height + 'px',
        display: 'block'
      })
    }
    const tooltip = document.querySelector('[data-air="tooltip"]')
    if (tooltip) {
      const info = inspectEl(el)
      tooltip.textContent = info?.selector ?? el.tagName.toLowerCase()
      Object.assign(tooltip.style, {
        top: (r.top - 22) + 'px',
        left: r.left + 'px',
        display: 'block'
      })
    }
  }

  function onOut(e) {
    // не убираем highlight при onOut — он обновится в onOver
  }

  function onPick(e) {
    e.preventDefault()
    e.stopImmediatePropagation()
    const el = lastEl || e.target
    stopPicker()
    if (!el || el.getAttribute?.('data-air')) return
    window.parent.postMessage({
      type: 'bridge:element_picked',
      data: inspectEl(el)
    }, '*')
  }

  // ── screenshot ────────────────────────────────────────────────────────
  async function takeScreenshot() {
    if (typeof html2canvas !== 'undefined') {
      try {
        const canvas = await html2canvas(document.body)
        window.parent.postMessage({
          type: 'bridge:screenshot',
          data: canvas.toDataURL('image/png')
        }, '*')
      } catch(e) {
        window.parent.postMessage({ type: 'bridge:screenshot', data: null, error: String(e) }, '*')
      }
    } else {
      window.parent.postMessage({
        type: 'bridge:screenshot', data: null,
        error: 'html2canvas not loaded'
      }, '*')
    }
  }

  // ── слушаем команды из shell ──────────────────────────────────────────
  window.addEventListener('message', e => {
    const msg = e.data
    if (!msg?.type) return
    if (msg.type === 'shell:start_picker') startPicker()
    if (msg.type === 'shell:stop_picker') stopPicker()
    if (msg.type === 'shell:screenshot') takeScreenshot()
    if (msg.type === 'shell:inspect') {
      const el = document.querySelector(msg.selector)
      window.parent.postMessage({
        type: 'bridge:inspect_result',
        data: inspectEl(el)
      }, '*')
    }
  })

  // Signal to shell that bridge is loaded and ready
  window.parent.postMessage({ type: 'bridge:ready' }, '*')
})()
`;
}

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
