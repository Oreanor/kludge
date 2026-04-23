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
  onGitOp: (op: 'add' | 'commit' | 'push' | 'init' | 'reset-prev' | 'reset-remote') => void
  t: I18n
}

export default function GitPanel({
  workspaceRoot, gitBranch, gitBranches, gitBusy,
  newBranchMode, newBranchName,
  onBranchChange, onNewBranchNameChange, onCreateBranch, onCancelNewBranch,
  onGitOp, t,
}: Props) {
  const hasRepo = gitBranches.length > 0
  const rowStyle = !workspaceRoot ? { ...styles.toolRow, opacity: 0.4 } : styles.toolRow

  return (
    <div style={rowStyle}>
      <span style={styles.rowLabel}>git</span>

      {hasRepo && !newBranchMode && (
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

      {workspaceRoot && !hasRepo && !newBranchMode && (
        <button
          style={styles.gitBtn}
          onClick={() => onGitOp('init')}
          disabled={gitBusy}
          title="git init"
        >{t.btnInit}</button>
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

      {hasRepo && (
        <>
          <button style={styles.gitBtn} onClick={() => onGitOp('commit')} disabled={gitBusy || !workspaceRoot}>{t.btnCommit}</button>
          <button style={{ ...styles.gitBtn, ...styles.gitBtnPush }} onClick={() => onGitOp('push')} disabled={gitBusy || !workspaceRoot}>{t.btnPush}</button>
          <button
            style={{ ...styles.gitBtn, opacity: 0.7 }}
            onClick={() => onGitOp('reset-prev')}
            disabled={gitBusy || !workspaceRoot}
            title="git reset --hard HEAD~1"
          >{t.btnResetPrev}</button>
          <button
            style={{ ...styles.gitBtn, opacity: 0.7 }}
            onClick={() => onGitOp('reset-remote')}
            disabled={gitBusy || !workspaceRoot}
            title="git fetch && git reset --hard origin/<branch>"
          >{t.btnResetRemote}</button>
        </>
      )}

      {gitBusy && <span style={styles.gitBusyDot}>⏳</span>}
    </div>
  )
}
