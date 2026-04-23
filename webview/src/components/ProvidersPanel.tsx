import React, { useState } from 'react'
import { ProviderInfo } from '../types'
import { I18n } from '../i18n'
import { styles } from '../styles'

interface Props {
  providers: ProviderInfo[]
  onSave: (providerId: string, key: string) => void
  onRemove: (providerId: string) => void
  onRestore: (providerId: string) => void
  t: I18n
}

export default function ProvidersPanel({ providers, onSave, onRemove, onRestore, t }: Props) {
  const [inputs, setInputs] = useState<Record<string, string>>({})

  const save = (id: string) => {
    const key = (inputs[id] ?? '').trim()
    if (!key) { return }
    onSave(id, key)
    setInputs(prev => ({ ...prev, [id]: '' }))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {providers.map(p => (
        <div key={p.id} style={styles.toolRow}>
          <span style={{ flexShrink: 0, fontSize: 11, minWidth: 90, opacity: 0.85 }}>{p.name}</span>

          {p.configured ? (
            <>
              <span style={{ flex: 1, fontSize: 11, opacity: 0.45, fontFamily: 'monospace' }}>{p.maskedKey}</span>
              <button style={styles.gitBtn} onClick={() => onRemove(p.id)}>{t.providerRemove}</button>
            </>
          ) : (
            <>
              <input
                value={inputs[p.id] ?? ''}
                onChange={e => setInputs(prev => ({ ...prev, [p.id]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') { save(p.id) } }}
                placeholder={p.pendingRemoval ? (p.pendingMasked ?? p.placeholder ?? t.providerPlaceholder) : (p.placeholder ?? t.providerPlaceholder)}
                style={{ ...styles.branchInput, flex: 1 }}
                type={p.placeholder ? 'text' : 'password'}
              />
              {p.pendingRemoval && (
                <button
                  style={{ ...styles.gitBtn, opacity: 0.8 }}
                  onClick={() => onRestore(p.id)}
                  title={t.providerRestore}
                >{t.providerRestore}</button>
              )}
              <button
                style={(inputs[p.id] ?? '').trim() ? styles.branchConfirm : { ...styles.branchConfirm, opacity: 0.4, cursor: 'not-allowed' }}
                disabled={!(inputs[p.id] ?? '').trim()}
                onClick={() => save(p.id)}
              >{t.providerSave}</button>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
