import React from 'react'
import { ModelOption } from '../types'
import { styles } from '../styles'

interface Props {
  models: ModelOption[]
  disabledModels: string[]
  onToggle: (modelId: string) => void
}

export default function ModelsPanel({ models, disabledModels, onToggle }: Props) {
  const providers = Array.from(new Set(models.map(m => m.provider ?? 'other')))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {providers.map(provider => (
        <div key={provider}>
          <div style={{ ...styles.rowLabel, display: 'block', marginBottom: 3 }}>{provider}</div>
          {models.filter(m => (m.provider ?? 'other') === provider).map(m => {
            const enabled = !disabledModels.includes(m.id)
            return (
              <label
                key={m.id}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => onToggle(m.id)}
                  style={{ cursor: 'pointer', accentColor: 'var(--vscode-button-background)' }}
                />
                <span style={{ fontSize: 11, opacity: enabled ? 1 : 0.45 }}>{m.label}</span>
              </label>
            )
          })}
        </div>
      ))}
    </div>
  )
}
