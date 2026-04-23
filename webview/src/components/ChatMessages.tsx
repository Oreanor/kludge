import React from 'react'
import ReactMarkdown from 'react-markdown'
import { Message, STREAMING_ID } from '../types'
import { I18n } from '../i18n'
import { styles } from '../styles'
import CollapsibleCode from './CollapsibleCode'

interface Props {
  messages: Message[]
  t: I18n
  bottomRef: React.RefObject<HTMLDivElement | null>
}

export default function ChatMessages({ messages, t, bottomRef }: Props) {
  return (
    <div style={styles.messages}>
      {messages.length === 0 && (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>✦</div>
          <div>{t.emptyTitle}</div>
          <div style={styles.emptyHint}>{t.emptyHint}</div>
        </div>
      )}
      {messages.map(m => (
        <div
          key={m.id}
          style={
            m.role === 'user'
              ? { ...styles.bubble, ...styles.user, ...(m.source === 'telegram' ? styles.telegramUser : {}) }
              : { ...styles.bubble, ...styles.assistant }
          }
        >
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
                    return <CollapsibleCode language={match?.[1] ?? ''} code={codeString} t={t} />
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
  )
}
