import React from 'react'
import { ModelOption } from '../types'
import { I18n } from '../i18n'
import { styles } from '../styles'

interface Props {
  models: ModelOption[]
  disabledProviders: string[]
  selectedModel: string
  onModelChange: (id: string) => void
  onToggleKeys: () => void
  providersOpen: boolean
  t: I18n
}

export default function ModelBar({ models, disabledProviders, selectedModel, onModelChange, onToggleKeys, providersOpen, t }: Props) {
  const visibleModels = models.filter(m => !disabledProviders.includes(m.provider ?? ''))
  const providers = Array.from(new Set(visibleModels.map(m => m.provider)))

  return (
    <div style={styles.toolRow}>
      {models.length > 0 && (
        <>
          <span style={styles.rowLabel}>{t.modelLabel}</span>
          <select
            value={selectedModel}
            onChange={e => onModelChange(e.target.value)}
            style={styles.promptSelect}
          >
            <option value="auto">{t.modelAuto}</option>
            {providers.map(provider => (
              <optgroup key={provider} label={provider ?? ''}>
                {visibleModels.filter(m => m.provider === provider).map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </>
      )}
      <button
        style={{ ...styles.iconButton, opacity: providersOpen ? 1 : 0.6 }}
        onClick={onToggleKeys}
      >{t.providersToggle}</button>
    </div>
  )
}
