import React, { useState, useMemo } from 'react'
import * as LucideIcons from 'lucide-react'
import { I18n } from '../i18n'
import { styles } from '../styles'

const ALL_NAMES: string[] = (Object.keys(LucideIcons) as string[]).filter(
  k => /^[A-Z]/.test(k) && !k.endsWith('Icon')
)

const MAX_RESULTS = 80

interface Props {
  onPick: (iconName: string) => void
  t: I18n
}

export default function IconSearch({ onPick, t }: Props) {
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return ALL_NAMES
      .filter(name => name.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS)
  }, [query])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={styles.toolRow}>
        <span style={styles.rowLabel}>icons</span>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t.iconSearchPlaceholder}
          style={inputStyle}
        />
        {query.length >= 2 && (
          <span style={{ ...styles.rowLabel, opacity: 0.4 }}>
            {results.length === MAX_RESULTS ? `${MAX_RESULTS}+` : results.length}
          </span>
        )}
      </div>

      {results.length > 0 && (
        <div style={resultsStyle}>
          {results.map(name => {
            const Icon = (LucideIcons as Record<string, React.ElementType>)[name]
            return (
              <button
                key={name}
                title={name}
                onClick={() => onPick(name)}
                style={btnStyle}
              >
                <Icon size={15} strokeWidth={1.5} />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  background: 'var(--vscode-input-background)',
  color: 'var(--vscode-input-foreground)',
  border: '1px solid var(--vscode-input-border)',
  borderRadius: 3,
  padding: '3px 6px',
  fontSize: 11,
  fontFamily: 'inherit',
}

const resultsStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  gap: 2,
  overflowX: 'auto',
  padding: '4px 2px',
  background: 'var(--vscode-editor-inactiveSelectionBackground)',
  borderRadius: 4,
}

const btnStyle: React.CSSProperties = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  background: 'transparent',
  color: 'var(--vscode-foreground)',
  border: '1px solid transparent',
  borderRadius: 3,
  cursor: 'pointer',
  padding: 0,
}
