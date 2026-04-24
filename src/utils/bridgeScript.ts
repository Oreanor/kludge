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
