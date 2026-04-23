import React from 'react'
import { I18n } from '../i18n'
import { styles } from '../styles'

interface Props {
  workspaceRoot: string | null
  npmScripts: string[]
  selectedScript: string
  onScriptChange: (script: string) => void
  onRun: () => void
  t: I18n
}

export default function NpmPanel({ workspaceRoot, npmScripts, selectedScript, onScriptChange, onRun }: Props) {
  const rowStyle = !workspaceRoot ? { ...styles.toolRow, opacity: 0.4 } : styles.toolRow

  return (
    <div style={rowStyle}>
      <span style={styles.rowLabel}>npm run</span>
      <select
        value={selectedScript}
        onChange={e => onScriptChange(e.target.value)}
        style={styles.promptSelect}
        disabled={!workspaceRoot}
        title="npm"
      >
        <option value="install">install</option>
        {npmScripts.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <button
        style={styles.runButton}
        disabled={!workspaceRoot}
        onClick={onRun}
        title={`npm ${selectedScript === 'install' ? 'install' : `run ${selectedScript}`}`}
      >▶</button>
    </div>
  )
}
