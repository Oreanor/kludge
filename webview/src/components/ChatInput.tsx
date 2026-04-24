import React from 'react'
import { I18n } from '../i18n'
import { styles } from '../styles'

interface Props {
  input: string
  isStreaming: boolean
  textareaRef: React.RefObject<HTMLTextAreaElement | null> | null
  onChange: (value: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onSend: () => void
  onStop: () => void
  onClear: () => void
  onOpenPreview: () => void
  t: I18n
}

export default function ChatInput({ input, isStreaming, textareaRef, onChange, onKeyDown, onSend, onStop, onClear, onOpenPreview, t }: Props) {
  return (
    <div style={styles.textareaRow}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignSelf: 'stretch' }}>
        <button style={{ ...styles.previewButton, flex: 1 }} onClick={onOpenPreview}>{t.btnPreview}</button>
        <button style={{ ...styles.clearButton, flex: 1 }} onClick={onClear}>{t.btnClear}</button>
      </div>
      <textarea
        ref={textareaRef}
        style={styles.textarea}
        value={input}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={isStreaming ? t.placeholderStreaming : t.placeholder}
        rows={2}
        disabled={isStreaming}
      />
      {isStreaming ? (
        <button style={styles.stopButton} onClick={onStop}>{t.btnStop}</button>
      ) : (
        <button style={styles.sendButton} onClick={onSend} disabled={!input.trim()}>{t.btnSend}</button>
      )}
    </div>
  )
}
