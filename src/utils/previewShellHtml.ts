export function getPreviewShellHtml(url: string): string {
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
    #picker-overlay {
      display:none;
      position:absolute; inset:0;
      z-index:10;
      cursor:crosshair;
    }
    #picker-overlay.active {
      display:block;
    }
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

    frame.addEventListener('load', () => {
      crossoriginBar.style.display = 'none'
      clearTimeout(bridgeReadyTimer)
      if (!bridgeReady) {
        bridgeReadyTimer = setTimeout(() => {
          if (!bridgeReady) { crossoriginBar.style.display = 'block' }
        }, 3000)
      }
    })

    window.addEventListener('message', e => {
      if (e.source !== frame.contentWindow) return
      const msg = e.data
      if (!msg?.type) return

      if (msg.type === 'bridge:ready') {
        bridgeReady = true
        crossoriginBar.style.display = 'none'
        clearTimeout(bridgeReadyTimer)
        if (pickerActive) {
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
        vscode.postMessage({ type: 'bridge:element_picked', data: null })
      } else {
        activatePicker()
      }
    }

    function activatePicker() {
      pickerActive = true
      document.getElementById('btn-picker').classList.add('active')

      if (bridgeReady) {
        overlay.classList.remove('active')
        hint.classList.add('active')
        frame.contentWindow?.postMessage({ type: 'shell:start_picker' }, '*')
      } else {
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
        vscode.postMessage({ type: 'bridge:element_picked', data: null })
      }
    }

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
