import React, { useState, useEffect, useRef, useCallback } from 'react'
import { getStrings } from './i18n'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

declare const acquireVsCodeApi: () => {
  postMessage: (msg: unknown) => void
}

const vscode = acquireVsCodeApi()

interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
  source?: 'telegram' | 'preview-picker' | 'extension'
}

interface PickedElement {
  selector: string
  tagName: string
  rect: { width: number; height: number; top: number; left: number }
  styles: Record<string, string>
  crossOrigin?: boolean
}

interface ModelOption {
  id: string
  label: string
  provider?: string
}

const STREAMING_ID = '__streaming__'

// ── свёрнутый код-блок ────────────────────────────────────────────────────
function CollapsibleCode({ language, code }: { language: string; code: string }) {
  const [open, setOpen] = useState(false)
  const lines = code.split('\n')
  const preview = lines.slice(0, 3).join('\n') + (lines.length > 3 ? '\n…' : '')

  return (
    <div style={{ margin: '8px 0', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 10px',
          background: 'rgba(255,255,255,0.05)',
          cursor: 'pointer',
          userSelect: 'none',
          fontSize: 11,
          color: 'rgba(255,255,255,0.5)',
        }}
      >
        <span>{language || 'code'} · {lines.length} строк</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(code) }}
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: '#ccc',
              border: 'none',
              borderRadius: 4,
              padding: '1px 8px',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            copy
          </button>
          <span>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {!open && (
        <div style={{ position: 'relative' }}>
          <SyntaxHighlighter
            style={vscDarkPlus}
            language={language || 'text'}
            PreTag="div"
            customStyle={{ margin: 0, borderRadius: 0, fontSize: 12, padding: '8px 12px', maxHeight: 72, overflow: 'hidden' }}
          >
            {preview}
          </SyntaxHighlighter>
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 32,
            background: 'linear-gradient(transparent, #1e1e1e)',
            pointerEvents: 'none',
          }} />
        </div>
      )}

      {open && (
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          <SyntaxHighlighter
            style={vscDarkPlus}
            language={language || 'text'}
            PreTag="div"
            customStyle={{ margin: 0, borderRadius: 0, fontSize: 12, padding: '12px' }}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      )}
    </div>
  )
}

function ElementChip({ el, onRemove }: { el: PickedElement; onRemove: () => void }) {
  const [hovered, setHovered] = useState(false)

  const label = el.crossOrigin
    ? `(${el.rect.left}, ${el.rect.top})`
    : el.selector

  const popup = !el.crossOrigin && (
    <div style={chipStyles.popup}>
      <div>{el.rect.width}×{el.rect.height}px</div>
      {el.styles.fontSize   && <div>font: {el.styles.fontSize} {el.styles.fontWeight}</div>}
      {el.styles.color      && <div>color: {el.styles.color}</div>}
      {el.styles.background && <div>bg: {el.styles.background}</div>}
      {el.styles.padding    && <div>padding: {el.styles.padding}</div>}
    </div>
  )

  return (
    <div
      style={chipStyles.wrap}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {hovered && popup}
      <span style={chipStyles.icon}>⊕</span>
      <span style={chipStyles.label}>{label}</span>
      <button style={chipStyles.remove} onClick={onRemove} title="Убрать">✕</button>
    </div>
  )
}

const chipStyles: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    background: 'rgba(127,119,221,0.18)',
    border: '1px solid rgba(127,119,221,0.5)',
    borderRadius: 4,
    padding: '2px 6px',
    fontSize: 11,
    cursor: 'default',
    userSelect: 'none',
    maxWidth: 220,
    flexShrink: 0,
  },
  icon: { color: '#7F77DD', flexShrink: 0 },
  label: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'var(--vscode-foreground)',
  },
  remove: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.4)',
    cursor: 'pointer',
    padding: '0 0 0 2px',
    fontSize: 10,
    lineHeight: 1,
    flexShrink: 0,
  },
  popup: {
    position: 'absolute',
    bottom: '110%',
    left: 0,
    background: 'var(--vscode-editorHoverWidget-background, #252526)',
    border: '1px solid var(--vscode-editorHoverWidget-border, #454545)',
    borderRadius: 4,
    padding: '6px 8px',
    fontSize: 11,
    lineHeight: 1.6,
    whiteSpace: 'nowrap',
    zIndex: 100,
    color: 'var(--vscode-foreground)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
    pointerEvents: 'none',
  },
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [pickedElement, setPickedElement] = useState<PickedElement | null>(null)
  const [locale, setLocale] = useState('en')
  const t = getStrings(locale)
  const [models, setModels] = useState<ModelOption[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('auto')
  const [npmScripts, setNpmScripts] = useState<string[]>([])
  const [selectedScript, setSelectedScript] = useState<string>('build')
  const [gitBranch, setGitBranch] = useState<string>('')
  const [gitBranches, setGitBranches] = useState<string[]>([])
  const [gitBusy, setGitBusy] = useState(false)
  const [newBranchMode, setNewBranchMode] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lastUserInputRef = useRef('')

  // ── auto-resize textarea ──────────────────────────────────────────────
  const resizeTextarea = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) { return }
    ta.style.height = 'auto'
    const maxHeight = 160
    ta.style.height = Math.min(ta.scrollHeight, maxHeight) + 'px'
    ta.style.overflowY = ta.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [])

  useEffect(() => { resizeTextarea() }, [input, resizeTextarea])

  const openPreview = () => vscode.postMessage({ type: 'command', command: 'air.openPreview' })

  const newChat = () => {
    setMessages([])
    vscode.postMessage({ type: 'clear-history', conversationId: 'default' })
  }

  const onModelChange = (modelId: string) => {
    setSelectedModel(modelId)
  }

  const onBranchChange = (value: string) => {
    if (value === '__new__') { setNewBranchMode(true); return }
    vscode.postMessage({ type: 'git-checkout', branch: value, isNew: false })
  }

  const createBranch = () => {
    const name = newBranchName.trim()
    if (!name) { return }
    vscode.postMessage({ type: 'git-checkout', branch: name, isNew: true })
    setNewBranchMode(false)
    setNewBranchName('')
  }

  const addMsg = (text: string, id?: string) => {
    setMessages(prev => [...prev, {
      id: id ?? `sys-${Date.now()}`, role: 'assistant' as const, text,
    }])
  }

  const updateOrAddMsg = (id: string, text: string) => {
    setMessages(prev => {
      const idx = prev.findIndex(m => m.id === id)
      if (idx !== -1) {
        const next = [...prev]
        next[idx] = { ...next[idx], text }
        return next
      }
      return [...prev, { id, role: 'assistant' as const, text }]
    })
  }

  const gitOp = (op: 'add' | 'commit' | 'push') => {
    addMsg(t.msgGitProgress(op), `git-op-${op}`)
    vscode.postMessage({ type: `git-${op}` })
  }

  // при mount — сообщаем что готовы
  useEffect(() => {
    vscode.postMessage({ type: 'ready' })
  }, [])

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data
      if (!msg || typeof msg !== 'object') { return }

      switch (msg.type) {

        case 'models': {
          setModels(Array.isArray(msg.models) ? msg.models : [])
          break
        }

        case 'locale': {
          if (msg.locale) { setLocale(String(msg.locale)) }
          break
        }

        case 'npm-scripts': {
          const scripts: string[] = Array.isArray(msg.scripts) ? msg.scripts : []
          setNpmScripts(scripts)
          // выбрать осмысленный дефолт
          const preferred = ['dev', 'build', 'start']
          const def = preferred.find(s => scripts.includes(s)) ?? scripts[0]
          if (def) { setSelectedScript(def) }
          break
        }

        case 'git-info': {
          if (msg.branch) { setGitBranch(msg.branch) }
          if (Array.isArray(msg.branches)) { setGitBranches(msg.branches) }
          break
        }

        case 'git-busy': {
          setGitBusy(!!msg.busy)
          break
        }

        case 'git-op-done': {
          setGitBusy(false)
          const opId = `git-op-${msg.op}`
          if (msg.op === 'add') {
            updateOrAddMsg(opId, t.msgGitAdded)
          } else if (msg.op === 'commit') {
            updateOrAddMsg(opId, t.msgGitCommitted(msg.commitMsg))
          } else if (msg.op === 'push') {
            updateOrAddMsg(opId, t.msgGitPushed(msg.commitMsg))
          }
          if (msg.op === 'commit' || msg.op === 'push') {
            vscode.postMessage({ type: 'git-info' })
          }
          break
        }

        case 'git-error': {
          setGitBusy(false)
          addMsg(t.msgGitError(String(msg.error ?? '')))
          break
        }

        case 'dev-polling': {
          const ports: number[] = Array.isArray(msg.ports) ? msg.ports : []
          updateOrAddMsg('dev-status', t.msgDevWaiting(ports.join(', ')))
          break
        }

        case 'dev-server-ready': {
          updateOrAddMsg('dev-status', t.msgDevReady(msg.url))
          break
        }

        case 'dev-polling-timeout': {
          updateOrAddMsg('dev-status', '⚠ Сервер не обнаружен за 60 сек — открой превью вручную (⬡)')
          break
        }

        case 'history': {
          const msgs: Message[] = Array.isArray(msg.messages)
            ? msg.messages.map((m: any, i: number) => ({
                id: `hist-${i}`,
                role: m.role === 'assistant' ? 'assistant' : 'user',
                text: m.content ?? '',
              }))
            : []
          if (msgs.length > 0) {
            setMessages(msgs)
          }
          break
        }

        case 'user-message': {
          const from: string = msg.from ?? ''
          const source: Message['source'] =
            from === 'Preview Picker' ? 'preview-picker'
            : from.startsWith('@') || msg.source === 'telegram' ? 'telegram'
            : 'extension'
          setMessages(prev => [
            ...prev,
            { id: `ext-user-${Date.now()}`, role: 'user', text: msg.text ?? '', source },
            { id: STREAMING_ID, role: 'assistant', text: '' },
          ])
          setIsStreaming(true)
          break
        }

        case 'stream-start': {
          setMessages(prev => {
            if (prev.some(m => m.id === STREAMING_ID)) { return prev }
            return [...prev, { id: STREAMING_ID, role: 'assistant', text: '' }]
          })
          setIsStreaming(true)
          break
        }

        case 'delta': {
          const delta = String(msg.delta ?? '')
          setMessages(prev => prev.map(m =>
            m.id === STREAMING_ID ? { ...m, text: m.text + delta } : m
          ))
          break
        }

        case 'done':
        case 'stopped': {
          setMessages(prev => prev.map(m =>
            m.id === STREAMING_ID ? { ...m, id: `msg-${Date.now()}` } : m
          ))
          setIsStreaming(false)
          break
        }

        case 'response': {
          const text = String(msg.text ?? '')
          setMessages(prev => {
            const idx = prev.findIndex(m => m.id === STREAMING_ID)
            if (idx !== -1) {
              const updated = [...prev]
              updated[idx] = { id: `msg-${Date.now()}`, role: 'assistant', text }
              return updated
            }
            return [...prev, { id: `msg-${Date.now()}`, role: 'assistant', text }]
          })
          setIsStreaming(false)
          break
        }

        case 'error': {
          setMessages(prev => {
            const filtered = prev.filter(m => m.id !== STREAMING_ID)
            return [...filtered, { id: `err-${Date.now()}`, role: 'assistant', text: `⚠ ${msg.error ?? 'Ошибка'}` }]
          })
          setIsStreaming(false)
          break
        }

        case 'picked-element': {
          if (msg.data) { setPickedElement(msg.data as PickedElement) }
          break
        }

        case 'picker-done':
          break
      }
    }

    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [selectedModel, locale])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = () => {
    if (!input.trim() || isStreaming) { return }
    const text = input.trim()
    lastUserInputRef.current = text

    // Build display text: show element selector inline if attached
    const displayText = pickedElement
      ? `${text}\n\`${pickedElement.selector}\``
      : text

    setMessages(prev => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', text: displayText },
      { id: STREAMING_ID, role: 'assistant', text: '' },
    ])
    setIsStreaming(true)

    // Build element context string appended to the message for the AI
    let fullText = text
    if (pickedElement) {
      const el = pickedElement
      if (el.crossOrigin) {
        fullText += `\n\n[Координаты клика в preview: (${el.rect.left}, ${el.rect.top})]`
      } else {
        fullText += `\n\n[Элемент из preview: ${el.selector}` +
          ` | ${el.rect.width}×${el.rect.height}px` +
          ` | font: ${el.styles.fontSize} ${el.styles.fontWeight}` +
          ` | color: ${el.styles.color}` +
          ` | bg: ${el.styles.background}]`
      }
    }

    vscode.postMessage({
      type: 'send',
      payload: {
        text: fullText,
        modelId: selectedModel !== 'default' ? selectedModel : undefined,
        conversationId: 'default',
        context: { taskKind: pickedElement ? 'preview' : 'chat' },
      }
    })
    setInput('')
    setPickedElement(null)
  }

  const stop = () => {
    vscode.postMessage({ type: 'stop' })
    setMessages(prev => prev.filter(m => m.id !== STREAMING_ID))
    setIsStreaming(false)
    setInput(lastUserInputRef.current)
    setTimeout(() => {
      textareaRef.current?.focus()
      const len = textareaRef.current?.value.length ?? 0
      textareaRef.current?.setSelectionRange(len, len)
    }, 50)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div style={styles.root}>

      {/* ── Сообщения ── */}
      <div style={styles.messages}>
        {messages.length === 0 && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>✦</div>
            <div>AIR готов к работе</div>
            <div style={styles.emptyHint}>Enter — отправить · Shift+Enter — перенос строки</div>
          </div>
        )}
        {messages.map(m => (
          <div key={m.id} style={
            m.role === 'user'
              ? { ...styles.bubble, ...styles.user, ...(m.source === 'telegram' ? styles.telegramUser : {}) }
              : { ...styles.bubble, ...styles.assistant }
          }>
            {m.source === 'telegram' && (
              <div style={styles.telegramBadge}>📱 Telegram</div>
            )}
            {m.source === 'preview-picker' && (
              <div style={styles.telegramBadge}>🎯 Preview Picker</div>
            )}
            <span style={m.id === STREAMING_ID ? styles.streaming : undefined}>
              <ReactMarkdown
                components={{
                  code({ node, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '')
                    const codeString = String(children).replace(/\n$/, '')
                    const isBlock = codeString.includes('\n') || match

                    if (isBlock) {
                      return <CollapsibleCode language={match?.[1] ?? ''} code={codeString} />
                    }

                    return (
                      <code
                        style={{
                          background: 'rgba(255,255,255,0.1)',
                          borderRadius: 3,
                          padding: '1px 5px',
                          fontSize: '0.9em',
                          fontFamily: 'var(--vscode-editor-font-family)',
                        }}
                        {...props}
                      >
                        {children}
                      </code>
                    )
                  },
                  p({ children }) {
                    return <p style={{ margin: '4px 0', lineHeight: 1.6 }}>{children}</p>
                  },
                  ul({ children }) {
                    return <ul style={{ margin: '4px 0', paddingLeft: 20 }}>{children}</ul>
                  },
                  ol({ children }) {
                    return <ol style={{ margin: '4px 0', paddingLeft: 20 }}>{children}</ol>
                  },
                  li({ children }) {
                    return <li style={{ margin: '2px 0' }}>{children}</li>
                  },
                  strong({ children }) {
                    return <strong style={{ fontWeight: 600 }}>{children}</strong>
                  },
                  blockquote({ children }) {
                    return (
                      <blockquote style={{
                        borderLeft: '3px solid var(--vscode-activityBarBadge-background)',
                        margin: '6px 0',
                        paddingLeft: 10,
                        opacity: 0.85,
                      }}>
                        {children}
                      </blockquote>
                    )
                  },
                }}
              >
                {m.text}
              </ReactMarkdown>
              {m.id === STREAMING_ID && <span style={styles.cursor}>▋</span>}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* ── Инпут ── */}
      <div style={styles.inputRow}>
        {pickedElement && (
          <div style={styles.chipRow}>
            <ElementChip el={pickedElement} onRemove={() => setPickedElement(null)} />
          </div>
        )}
        <textarea
          ref={textareaRef}
          style={styles.textarea}
          value={input}
          onChange={e => { setInput(e.target.value); resizeTextarea() }}
          onKeyDown={onKeyDown}
          placeholder={
            isStreaming
              ? 'Генерация... нажми Stop чтобы отредактировать запрос'
              : 'Напиши сообщение...'
          }
          rows={1}
          disabled={isStreaming}
        />
        <div style={styles.buttons}>
          {isStreaming ? (
            <button style={styles.stopButton} onClick={stop}>⏹ Stop</button>
          ) : (
            <button style={styles.sendButton} onClick={send} disabled={!input.trim()}>Send</button>
          )}
          <button style={styles.iconButton} onClick={openPreview}>⬡ Preview</button>
          <button style={styles.iconButton} onClick={newChat}>✕ Clear</button>
        </div>
        {/* ── Git toolbar ── */}
        <div style={styles.gitToolbar}>
          <select
            value={selectedScript}
            onChange={e => setSelectedScript(e.target.value)}
            style={styles.scriptSelect}
            title="npm скрипт"
          >
            <option value="install">install</option>
            {npmScripts.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            style={styles.runButton}
            onClick={() => {
              const cmd = selectedScript === 'install' ? 'npm install' : `npm run ${selectedScript}`
              vscode.postMessage({ type: 'npm-run', script: selectedScript })
              if (selectedScript !== 'dev') {
                addMsg(`▶ Запускаю \`${cmd}\`…`)
              }
            }}
            title={`npm ${selectedScript === 'install' ? 'install' : `run ${selectedScript}`}`}
          >
            ▶
          </button>

          {gitBranches.length > 0 && !newBranchMode && (
            <select
              value={gitBranch}
              onChange={e => onBranchChange(e.target.value)}
              style={styles.branchSelect}
              title="Текущая ветка"
            >
              {gitBranches.map(b => (
                <option key={b} value={b}>🌿 {b}</option>
              ))}
              <option value="__new__">＋ Новая ветка…</option>
            </select>
          )}

          {newBranchMode && (
            <div style={styles.branchInputRow}>
              <input
                autoFocus
                value={newBranchName}
                onChange={e => setNewBranchName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { createBranch() } if (e.key === 'Escape') { setNewBranchMode(false) } }}
                placeholder="имя ветки"
                style={styles.branchInput}
              />
              <button style={styles.branchConfirm} onClick={createBranch} title="Создать">✓</button>
              <button style={styles.branchCancel} onClick={() => setNewBranchMode(false)} title="Отмена">✕</button>
            </div>
          )}

          <button style={styles.gitBtn} onClick={() => gitOp('add')} disabled={gitBusy}>＋ Add</button>
          <button style={styles.gitBtn} onClick={() => gitOp('commit')} disabled={gitBusy}>✓ Commit</button>
          <button style={{ ...styles.gitBtn, ...styles.gitBtnPush }} onClick={() => gitOp('push')} disabled={gitBusy}>⬆ Push</button>
          {gitBusy && <span style={styles.gitBusyDot}>⏳</span>}
        </div>


        {/* ── Model select ── */}
        {models.length > 0 && (
          <select
            value={selectedModel}
            onChange={e => onModelChange(e.target.value)}
            style={styles.modelSelect}
          >
            <option value="auto">⚡ Авто</option>
            <optgroup label="Gemini">
              {models.filter(m => m.provider === 'gemini').map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </optgroup>
            <optgroup label="Groq">
              {models.filter(m => m.provider === 'groq').map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </optgroup>
          </select>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    fontFamily: 'var(--vscode-font-family)',
    fontSize: 'var(--vscode-font-size)',
    color: 'var(--vscode-foreground)',
    background: 'var(--vscode-sideBar-background)',
  },
  modelSelect: {
    width: '100%',
    background: 'var(--vscode-input-background)',
    color: 'var(--vscode-input-foreground)',
    border: '1px solid var(--vscode-input-border)',
    borderRadius: 3,
    padding: '3px 6px',
    fontSize: 11,
    cursor: 'pointer',
  },
  gitToolbar: {
    display: 'flex',
    gap: 4,
    alignItems: 'center',
  },
  scriptSelect: {
    flex: '0 1 90px',
    minWidth: 0,
    background: 'var(--vscode-input-background)',
    color: 'var(--vscode-input-foreground)',
    border: '1px solid var(--vscode-input-border)',
    borderRadius: 3,
    padding: '3px 4px',
    fontSize: 11,
    cursor: 'pointer',
  },
  runButton: {
    flexShrink: 0,
    background: '#22c55e',
    color: '#fff',
    border: 'none',
    borderRadius: 3,
    padding: '3px 7px',
    fontSize: 13,
    cursor: 'pointer',
    lineHeight: 1,
  },
  branchSelect: {
    flex: 1,
    minWidth: 0,
    background: 'var(--vscode-input-background)',
    color: 'var(--vscode-input-foreground)',
    border: '1px solid var(--vscode-input-border)',
    borderRadius: 3,
    padding: '3px 6px',
    fontSize: 11,
    cursor: 'pointer',
  },
  branchInputRow: {
    flex: 1,
    display: 'flex',
    gap: 3,
    alignItems: 'center',
    minWidth: 0,
  },
  branchInput: {
    flex: 1,
    minWidth: 0,
    background: 'var(--vscode-input-background)',
    color: 'var(--vscode-input-foreground)',
    border: '1px solid var(--vscode-focusBorder)',
    borderRadius: 3,
    padding: '2px 6px',
    fontSize: 11,
  },
  branchConfirm: {
    background: '#22c55e',
    color: '#fff',
    border: 'none',
    borderRadius: 3,
    padding: '2px 6px',
    fontSize: 11,
    cursor: 'pointer',
  },
  branchCancel: {
    background: 'var(--vscode-button-secondaryBackground)',
    color: 'var(--vscode-button-secondaryForeground)',
    border: 'none',
    borderRadius: 3,
    padding: '2px 6px',
    fontSize: 11,
    cursor: 'pointer',
  },
  gitBtn: {
    flexShrink: 0,
    background: 'var(--vscode-button-secondaryBackground)',
    color: 'var(--vscode-button-secondaryForeground)',
    border: 'none',
    borderRadius: 3,
    padding: '3px 7px',
    fontSize: 12,
    cursor: 'pointer',
  },
  gitBtnPush: {
    background: '#7F77DD',
    color: '#fff',
  },
  gitBusyDot: {
    fontSize: 13,
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flex: 1,
    opacity: 0.4,
    fontSize: 12,
    userSelect: 'none',
    paddingTop: 40,
  },
  emptyIcon: {
    fontSize: 24,
    opacity: 0.6,
  },
  emptyHint: {
    fontSize: 10,
    opacity: 0.7,
  },
  bubble: {
    borderRadius: 8,
    padding: '6px 10px',
    maxWidth: '92%',
    wordBreak: 'break-word',
    lineHeight: 1.5,
  },
  user: {
    alignSelf: 'flex-end',
    background: 'var(--vscode-button-background)',
    color: 'var(--vscode-button-foreground)',
  },
  assistant: {
    alignSelf: 'flex-start',
    background: 'var(--vscode-editor-inactiveSelectionBackground)',
  },
  telegramUser: {
    background: 'var(--vscode-activityBarBadge-background)',
    color: 'var(--vscode-activityBarBadge-foreground)',
  },
  telegramBadge: {
    fontSize: '10px',
    opacity: 0.7,
    marginBottom: 2,
  },
  streaming: {
    opacity: 0.9,
  },
  cursor: {
    animation: 'none',
    opacity: 0.7,
    marginLeft: 1,
  },
  inputRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: 8,
    borderTop: '1px solid var(--vscode-panel-border)',
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
  },
  textarea: {
    width: '100%',
    background: 'var(--vscode-input-background)',
    color: 'var(--vscode-input-foreground)',
    border: '1px solid var(--vscode-input-border)',
    borderRadius: 4,
    padding: 6,
    resize: 'none',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    boxSizing: 'border-box',
    minHeight: 32,
    maxHeight: 160,
    lineHeight: '1.5',
    overflowY: 'hidden',
  },
  buttons: {
    display: 'flex',
    gap: 6,
  },
  sendButton: {
    flexShrink: 0,
    background: '#0ea5e9',
    color: '#ffffff',
    border: 'none',
    borderRadius: 4,
    padding: '4px 14px',
    cursor: 'pointer',
  },
  stopButton: {
    flexShrink: 0,
    background: '#ef4444',
    color: '#ffffff',
    border: 'none',
    borderRadius: 4,
    padding: '4px 12px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  iconButton: {
    background: 'var(--vscode-button-secondaryBackground)',
    color: 'var(--vscode-button-secondaryForeground)',
    border: 'none',
    borderRadius: 4,
    padding: '4px 8px',
    cursor: 'pointer',
    fontSize: 14,
  },
}