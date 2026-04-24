import React, { useState, useMemo, useRef } from 'react'
import { UI_LIBRARIES } from '../data/uiLibraries'
import { styles } from '../styles'

interface Props {
  onPick: (text: string) => void
}

export default function UIComponentPicker({ onPick }: Props) {
  const [libId, setLibId] = useState(UI_LIBRARIES[0].id)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const lib = UI_LIBRARIES.find(l => l.id === libId)!

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return lib.components
    return lib.components.filter(c => c.toLowerCase().includes(q))
  }, [lib, search])

  const pick = (name: string) => {
    onPick(`\`[${lib.name}: ${name}]\``)
    setSearch('')
    setOpen(false)
    inputRef.current?.focus()
  }

  const handleLibChange = (id: string) => {
    setLibId(id)
    setSearch('')
    setOpen(false)
  }

  const handleFocus = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpen(true)
  }

  const handleBlur = () => {
    // delay so click on dropdown item fires before close
    closeTimer.current = setTimeout(() => setOpen(false), 150)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && filtered.length > 0) {
      e.preventDefault()
      pick(filtered[0])
    }
    if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  return (
    <div style={styles.toolRow}>
      <span style={styles.rowLabel}>UI</span>

      <select
        value={libId}
        onChange={e => handleLibChange(e.target.value)}
        style={{ ...styles.promptSelect, flexShrink: 0, flex: 'none' }}
      >
        {UI_LIBRARIES.map(l => (
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
      </select>

      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <input
          ref={inputRef}
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true) }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="component…"
          style={{ ...styles.branchInput, width: '100%', boxSizing: 'border-box' }}
        />
        {open && filtered.length > 0 && (
          <div style={dropdownStyle}>
            {filtered.map(c => (
              <div
                key={c}
                onMouseDown={e => { e.preventDefault(); pick(c) }}
                style={itemStyle}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--vscode-list-hoverBackground)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {c}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const dropdownStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 2px)',
  left: 0,
  right: 0,
  zIndex: 100,
  background: 'var(--vscode-input-background)',
  border: '1px solid var(--vscode-focusBorder)',
  borderRadius: 4,
  maxHeight: 180,
  overflowY: 'auto',
}

const itemStyle: React.CSSProperties = {
  padding: '3px 8px',
  fontSize: 11,
  cursor: 'pointer',
  background: 'transparent',
  userSelect: 'none',
}
