import React, { useState, useEffect, useRef } from 'react'

declare const acquireVsCodeApi: () => {
  postMessage: (msg: unknown) => void
}

const vscode = acquireVsCodeApi()

interface Message {
  role: 'user' | 'assistant'
  text: string
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const openPreview = () => vscode.postMessage({ type: 'command', command: 'air.openPreview' })
  const pickElement = () => vscode.postMessage({ type: 'command', command: 'air.pickElement' })



  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data
      if (!msg || typeof msg !== 'object') return

      switch (msg.type) {
        case 'history': {
          const msgs = Array.isArray(msg.messages)
            ? msg.messages.map((m: any) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', text: m.content }))
            : []
          setMessages(msgs as Message[])
          break
        }
        case 'stream-start': {
          // start a new assistant placeholder
          setMessages(prev => [...prev, { role: 'assistant', text: '' }])
          break
        }
        case 'delta': {
          const delta = String(msg.delta ?? '')
          setMessages(prev => {
            if (prev.length === 0) return prev
            const last = prev[prev.length - 1]
            if (last.role === 'assistant') {
              const updated = [...prev]
              updated[updated.length - 1] = { ...last, text: last.text + delta }
              return updated
            }
            // if last is user, append new assistant message
            return [...prev, { role: 'assistant', text: delta }]
          })
          break
        }
        case 'done': {
          // no-op for now; final 'response' will be sent separately
          break
        }
        case 'response': {
          const text = String(msg.text ?? '')
          setMessages(prev => {
            // if last message is assistant, replace it with final response
            if (prev.length > 0 && prev[prev.length - 1].role === 'assistant') {
              const updated = [...prev]
              updated[updated.length - 1] = { role: 'assistant', text }
              return updated
            }
            return [...prev, { role: 'assistant', text }]
          })
          break
        }
        case 'error': {
          const text = String(msg.error ?? 'error')
          setMessages(prev => [...prev, { role: 'assistant', text }])
          break
        }
        default:
          break
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = () => {
    if (!input.trim()) return
    setMessages(prev => [...prev, { role: 'user', text: input }])
    vscode.postMessage({ type: 'send', text: input })
    setInput('')
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div style={styles.root}>
      <div style={styles.messages}>
        {messages.map((m, i) => (
          <div key={i} style={m.role === 'user' ? styles.user : styles.assistant}>
            {m.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={styles.inputRow}>
        <textarea
          style={styles.textarea}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Напиши сообщение... (Enter — отправить)"
          rows={3}
        />
        <button style={styles.button} onClick={send}>
          Send
        </button>
        <button style={styles.iconButton} onClick={openPreview} title="Open Preview">⬡</button>
        <button style={styles.iconButton} onClick={pickElement} title="Pick Element">⊕</button>
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
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  user: {
    alignSelf: 'flex-end',
    background: 'var(--vscode-button-background)',
    color: 'var(--vscode-button-foreground)',
    borderRadius: 8,
    padding: '6px 10px',
    maxWidth: '80%',
  },
  assistant: {
    alignSelf: 'flex-start',
    background: 'var(--vscode-editor-inactiveSelectionBackground)',
    borderRadius: 8,
    padding: '6px 10px',
    maxWidth: '80%',
  },
  inputRow: {
    display: 'flex',
    gap: 6,
    padding: 8,
    borderTop: '1px solid var(--vscode-panel-border)',
  },
  textarea: {
    flex: 1,
    background: 'var(--vscode-input-background)',
    color: 'var(--vscode-input-foreground)',
    border: '1px solid var(--vscode-input-border)',
    borderRadius: 4,
    padding: 6,
    resize: 'none',
    fontFamily: 'inherit',
    fontSize: 'inherit',
  },
  button: {
    background: 'var(--vscode-button-background)',
    color: 'var(--vscode-button-foreground)',
    border: 'none',
    borderRadius: 4,
    padding: '0 12px',
    cursor: 'pointer',
  },
}