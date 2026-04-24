import React, { useState, useEffect } from 'react'
import { I18n } from '../i18n'
import { styles } from '../styles'

const SENTINEL = '••••••••••••'

interface Props {
  configured: boolean
  settingsOpen: boolean
  chatId: string
  onToggle: () => void
  onSave: (token: string, chatId: string) => void
  t: I18n
}

export default function TelegramSettings({ configured, settingsOpen, chatId, onToggle, onSave, t }: Props) {
  const [token, setToken] = useState(configured ? SENTINEL : '')
  const [cid, setCid] = useState(chatId)

  useEffect(() => { setCid(chatId) }, [chatId])
  useEffect(() => { if (configured) { setToken(SENTINEL) } else { setToken('') } }, [configured])

  const tokenUnchanged = token === SENTINEL
  const isDirty = !tokenUnchanged || cid !== chatId
  const canSave = cid.trim().length > 0 && (tokenUnchanged || token.trim().length > 0) && (!configured || isDirty)

  const save = () => {
    if (!canSave) { return }
    onSave(tokenUnchanged ? '' : token.trim(), cid.trim())
    if (!tokenUnchanged) { setToken(SENTINEL) }
  }

  return (
    <div style={styles.tgSettings}>
      <button style={styles.iconButton} onClick={onToggle}>
        {t.tgSettingsToggle}
        {configured && <span style={{ marginLeft: 4, color: '#22c55e', fontSize: 9 }}>●</span>}
      </button>

      {(!configured || settingsOpen) && (
        <div style={styles.tgSettingsForm}>
          {!configured && (
            <div style={styles.tgNotConfigured}>{t.tgNotConfigured}</div>
          )}
          <div style={styles.tgFieldRow}>
            <span style={styles.rowLabel}>{t.tgTokenLabel}</span>
            <input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              onFocus={() => { if (tokenUnchanged) { setToken('') } }}
              placeholder={t.tgTokenPlaceholder}
              style={styles.tgInput}
            />
          </div>
          <div style={styles.tgFieldRow}>
            <span style={styles.rowLabel}>{t.tgChatIdLabel}</span>
            <input
              type="text"
              value={cid}
              onChange={e => setCid(e.target.value)}
              placeholder={t.tgChatIdPlaceholder}
              style={styles.tgInput}
            />
          </div>
          <button
            style={{ ...styles.iconButton, background: '#0ea5e9', color: '#fff', opacity: canSave ? 1 : 0.5 }}
            onClick={save}
            disabled={!canSave}
          >
            {t.tgSave}
          </button>
        </div>
      )}
    </div>
  )
}
