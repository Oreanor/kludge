import React from 'react'
import { ModelOption, FolderItem } from '../types'
import { I18n } from '../i18n'
import { styles } from '../styles'

interface QuickPrompt {
  key: string
  label: string
  text: string
}

interface Props {
  models: ModelOption[]
  selectedModel: string
  onModelChange: (id: string) => void
  scopeFolders: FolderItem[]
  selectedScope: string
  onScopeChange: (scope: string) => void
  activeFile: string | null
  quickPrompts: QuickPrompt[]
  selectedPrompt: string
  onPromptChange: (key: string) => void
  isStreaming: boolean
  onSendQuickPrompt: () => void
  onOpenPreview: () => void
  onNewChat: () => void
  t: I18n
}

export default function QuickPrompts({
  models, selectedModel, onModelChange,
  scopeFolders, selectedScope, onScopeChange, activeFile,
  quickPrompts, selectedPrompt, onPromptChange,
  isStreaming, onSendQuickPrompt, onOpenPreview, onNewChat, t,
}: Props) {
  return (
    <>
      {/* Строка 1: превью, модель, очистить */}
      <div style={styles.toolRow}>
        <button style={styles.previewButton} onClick={onOpenPreview} title={t.btnPreview}>⬡</button>

        {models.length > 0 && (
          <>
                <span style={styles.rowLabel}>{t.modelLabel}</span>
          
          <select
            value={selectedModel}
            onChange={e => onModelChange(e.target.value)}
            style={styles.promptSelect}
          >
            <option value="auto">{t.modelAuto}</option>
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
          </>
        )}

        <button style={styles.iconButton} onClick={onNewChat}>{t.btnClear}</button>
      </div>

      {/* Строка 2: Действие [промпт] с [область] [▶] */}
      <div style={styles.toolRow}>
        <span style={styles.rowLabel}>{t.quickActionLabel}</span>

        <select
          value={selectedPrompt}
          onChange={e => onPromptChange(e.target.value)}
          style={styles.promptSelect}
          disabled={isStreaming}
          title={t.quickPromptTooltip}
        >
          {quickPrompts.map(p => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
        </select>

        <span style={styles.rowLabel}>{t.quickActionWith}</span>

        <select
          value={selectedScope}
          onChange={e => onScopeChange(e.target.value)}
          style={styles.promptSelect}
          title="scope"
        >
          <option value="file">
            📄 {activeFile ? activeFile.split('/').pop() : t.scopeLabelFile}
          </option>
          {scopeFolders.map(f => (
            <option key={f.path} value={`folder:${f.path}`}>
              {' '.repeat(f.depth * 3)}📁 {f.name}
            </option>
          ))}
          <option value="project">🗂 {t.scopeLabelProject}</option>
        </select>

        <button
          style={isStreaming ? { ...styles.quickRunButton, opacity: 0.5, cursor: 'not-allowed' } : styles.quickRunButton}
          onClick={onSendQuickPrompt}
          disabled={isStreaming}
          title={t.quickPromptTooltip}
        >▶</button>
      </div>
    </>
  )
}
