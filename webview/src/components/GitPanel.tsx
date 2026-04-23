import React from 'react'
import { I18n } from '../i18n'
import { styles } from '../styles'

interface Props {
  workspaceRoot: string | null
  gitBranch: string
  gitBranches: string[]
  gitBusy: boolean
  newBranchMode: boolean
  newBranchName: string
  onBranchChange: (value: string) => void
  onNewBranchNameChange: (name: string) => void
  onCreateBranch: () => void
  onCancelNewBranch: () => void
  onGitOp: (op: 'add' | 'commit' | 'push') => void
  t: I18n
}

export default function GitPanel({
  workspaceRoot, gitBranch, gitBranches, gitBusy,
  newBranchMode, newBranchName,
  onBranchChange, onNewBranchNameChange, onCreateBranch, onCancelNewBranch,
  onGitOp, t,
}: Props) {
  const rowStyle = !workspaceRoot ? { ...styles.toolRow, opacity: 0.4 } : styles.toolRow

  return (
    <div style={rowStyle}>
      <span style={styles.rowLabel}>git</span>

      {gitBranches.length > 0 && !newBranchMode && (
        <select
          value={gitBranch}
          onChange={e => onBranchChange(e.target.value)}
          style={{ ...styles.promptSelect, flex: 1 }}
          disabled={!workspaceRoot}
          title="branch"
        >
          {gitBranches.map(b => (
            <option key={b} value={b}>🌿 {b}</option>
          ))}
          <option value="__new__">{t.branchNew}</option>
        </select>
      )}

      {!workspaceRoot && !newBranchMode && (
        <select disabled style={{ ...styles.promptSelect, flex: 1 }}>
          <option>🌿 branch</option>
        </select>
      )}

      {newBranchMode && (
        <div style={styles.branchInputRow}>
          <input
            autoFocus
            value={newBranchName}
            onChange={e => onNewBranchNameChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') onCreateBranch()
              if (e.key === 'Escape') onCancelNewBranch()
            }}
            placeholder={t.branchPlaceholder}
            style={styles.branchInput}
          />
          <button style={styles.branchConfirm} onClick={onCreateBranch} title="✓">✓</button>
          <button style={styles.branchCancel} onClick={onCancelNewBranch} title="✕">✕</button>
        </div>
      )}

      <button style={styles.gitBtn} onClick={() => onGitOp('add')} disabled={gitBusy || !workspaceRoot}>{t.btnAdd}</button>
      <button style={styles.gitBtn} onClick={() => onGitOp('commit')} disabled={gitBusy || !workspaceRoot}>{t.btnCommit}</button>
      <button style={{ ...styles.gitBtn, ...styles.gitBtnPush }} onClick={() => onGitOp('push')} disabled={gitBusy || !workspaceRoot}>{t.btnPush}</button>
      {gitBusy && <span style={styles.gitBusyDot}>⏳</span>}
    </div>
  )
}
