import React, { useState } from 'react'
import { I18n } from '../i18n'
import { styles } from '../styles'

interface Props {
  input: string
  isStreaming: boolean
  disabled?: boolean
  textareaRef: React.RefObject<HTMLTextAreaElement | null> | null
  onChange: (value: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onSend: () => void
  onStop: () => void
  onClear: () => void
  onOpenPreview: () => void
  t: I18n
}

export default function ChatInput({ input, isStreaming, disabled, textareaRef, onChange, onKeyDown, onSend, onStop, onClear, onOpenPreview, t }: Props) {
  const [clearPending, setClearPending] = useState(false)
  const blocked = disabled && !isStreaming

  const handleClearClick = () => {
    if (clearPending) return
    setClearPending(true)
  }
  const handleClearConfirm = () => {
    setClearPending(false)
    onClear()
  }
  const handleClearCancel = () => {
    setClearPending(false)
  }

  return (
    <div style={styles.textareaRow}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignSelf: 'stretch' }}>
        <button style={{ ...styles.previewButton, flex: 1 }} onClick={onOpenPreview}>{t.btnPreview}</button>
        {clearPending ? (
          <div style={{ display: 'flex', gap: 2, flex: 1 }}>
            <button style={{ ...styles.branchConfirm, flex: 1, fontSize: 11 }} onClick={handleClearConfirm} title={t.confirmClear}>✓</button>
            <button style={{ ...styles.branchCancel, flex: 1, fontSize: 11 }} onClick={handleClearCancel}>✕</button>
          </div>
        ) : (
          <button style={{ ...styles.clearButton, flex: 1 }} onClick={handleClearClick}>{t.btnClear}</button>
        )}
      </div>
      <textarea
        ref={textareaRef}
        style={{ ...styles.textarea, opacity: blocked ? 0.4 : 1 }}
        value={input}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={isStreaming ? t.placeholderStreaming : t.placeholder}
        rows={2}
        disabled={isStreaming || blocked}
      />
      {isStreaming ? (
        <button style={styles.stopButton} onClick={onStop}>{t.btnStop}</button>
      ) : (
        <button style={styles.sendButton} onClick={onSend} disabled={!input.trim() || blocked}>{t.btnSend}</button>
      )}
    </div>
  )
}
