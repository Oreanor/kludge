import React, { useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { I18n } from '../i18n'

export default function CollapsibleCode({ language, code, t }: { language: string; code: string; t: I18n }) {
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
        <span>{language || 'code'} · {t.codeLinesLabel(lines.length)}</span>
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
            {t.codeCopyBtn}
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
