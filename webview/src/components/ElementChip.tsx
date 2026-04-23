import React, { useState } from 'react'
import { PickedElement } from '../types'
import { I18n } from '../i18n'

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

export default function ElementChip({ el, onRemove, t }: { el: PickedElement; onRemove: () => void; t: I18n }) {
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
      <button style={chipStyles.remove} onClick={onRemove} title={t.removeElement}>✕</button>
    </div>
  )
}
