import React from 'react'
import { Session } from '../types'
import { styles } from '../styles'

export const TELEGRAM_SESSION_ID = 'telegram'

interface Props {
  sessions: Session[]
  activeSessionId: string
  busySessionId: string | null
  telegramConfigured: boolean
  onSwitch: (id: string) => void
  onNew: () => void
  onClose: (id: string) => void
}

export default function SessionTabs({ sessions, activeSessionId, busySessionId, telegramConfigured, onSwitch, onNew, onClose }: Props) {
  const tgActive = activeSessionId === TELEGRAM_SESSION_ID
  return (
    <div style={styles.sessionBar}>
      {sessions.map(s => {
        const isActive = s.id === activeSessionId
        const isBusy = s.id === busySessionId
        return (
          <button
            key={s.id}
            style={isActive ? { ...styles.sessionTab, ...styles.sessionTabActive } : styles.sessionTab}
            onClick={() => onSwitch(s.id)}
            title={s.name}
          >
            {isBusy && <span style={{ fontSize: 8, opacity: 0.7 }}>●</span>}
            {s.name}
            {s.id !== 'default' && (
              <span
                style={styles.sessionTabClose}
                onClick={e => { e.stopPropagation(); onClose(s.id) }}
                title="Close"
              >×</span>
            )}
          </button>
        )
      })}
      <button style={styles.sessionTabAdd} onClick={onNew} title="New session">＋</button>
      <button
        style={tgActive
          ? { ...styles.sessionTab, ...styles.sessionTabActive, ...styles.sessionTabTelegram }
          : { ...styles.sessionTab, ...styles.sessionTabTelegram }}
        onClick={() => onSwitch(TELEGRAM_SESSION_ID)}
        title="Telegram Bot"
      >
        {!telegramConfigured && <span style={{ fontSize: 8, color: '#f59e0b' }}>●</span>}
        ✈ Telegram
      </button>
    </div>
  )
}
