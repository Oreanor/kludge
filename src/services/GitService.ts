import { execFile } from 'child_process'
import { promisify } from 'util'
import * as vscode from 'vscode'
import { ChatOrchestrator } from './chatOrchestrator'
import { ChatRequest } from '../types'

const execFileP = promisify(execFile)

export class GitService {
  constructor(
    private readonly postMessage: (msg: unknown) => void,
    private readonly orchestrator?: ChatOrchestrator,
  ) {}

  private async run(args: string[], cwd: string): Promise<string> {
    const { stdout } = await execFileP('git', args, { cwd })
    return stdout.trim()
  }

  async sendInfo(folder: string): Promise<void> {
    try {
      const [branch, branchList] = await Promise.all([
        this.run(['rev-parse', '--abbrev-ref', 'HEAD'], folder),
        this.run(['branch'], folder),
      ])
      const branches = branchList.split('\n').map(b => b.replace(/^\*\s*/, '').trim()).filter(Boolean)
      this.postMessage({ type: 'git-info', branch, branches })
    } catch { /* not a git repo */ }
  }

  async handleCheckout(branch: string, isNew: boolean, folder: string): Promise<void> {
    try {
      await this.run(isNew ? ['checkout', '-b', branch] : ['checkout', branch], folder)
      await this.sendInfo(folder)
    } catch (e: any) {
      this.postMessage({ type: 'git-error', error: String(e.stderr ?? e.message ?? e) })
    }
  }

  async handleAdd(folder: string): Promise<void> {
    this.postMessage({ type: 'git-busy', busy: true })
    try {
      await this.run(['add', '-A'], folder)
      this.postMessage({ type: 'git-op-done', op: 'add' })
    } catch (e: any) {
      this.postMessage({ type: 'git-error', error: String(e.stderr ?? e.message ?? e) })
    }
    this.postMessage({ type: 'git-busy', busy: false })
  }

  async handleCommitOrPush(isPush: boolean, folder: string): Promise<void> {
    this.postMessage({ type: 'git-busy', busy: true })
    try {
      await this.run(['add', '-A'], folder)
      const staged = await this.run(['diff', '--cached', '--stat'], folder)
      let commitMsg: string | undefined

      if (staged) {
        commitMsg = await this._promptCommitMessage(folder, staged)
        if (commitMsg === undefined) {
          this.postMessage({ type: 'git-busy', busy: false })
          return
        }
        await this.run(['commit', '-m', commitMsg], folder)
      }

      if (isPush) {
        try {
          await this.run(['push'], folder)
        } catch {
          const branch = await this.run(['rev-parse', '--abbrev-ref', 'HEAD'], folder)
          await this.run(['push', '-u', 'origin', branch], folder)
        }
      }

      this.postMessage({
        type: 'git-op-done',
        op: isPush ? 'push' : 'commit',
        commitMsg: staged ? commitMsg : undefined,
      })
    } catch (e: any) {
      this.postMessage({ type: 'git-error', error: String(e.stderr ?? e.message ?? e) })
    }
    this.postMessage({ type: 'git-busy', busy: false })
  }

  async handleInit(folder: string): Promise<void> {
    this.postMessage({ type: 'git-busy', busy: true })
    try {
      await this.run(['init'], folder)
      this.postMessage({ type: 'git-op-done', op: 'init' })
    } catch (e: any) {
      this.postMessage({ type: 'git-error', error: String(e.stderr ?? e.message ?? e) })
    }
    this.postMessage({ type: 'git-busy', busy: false })
  }

  async handleResetPrev(folder: string): Promise<void> {
    try {
      await this.run(['rev-parse', 'HEAD~1'], folder)
    } catch {
      this.postMessage({ type: 'git-error', error: 'Нет предыдущего коммита для отката' })
      return
    }
    const choice = await vscode.window.showWarningMessage(
      'Откатить последний коммит? Все изменения в нём будут потеряны.',
      { modal: true },
      'Откатить'
    )
    if (choice !== 'Откатить') { return }
    this.postMessage({ type: 'git-busy', busy: true })
    try {
      await this.run(['reset', '--hard', 'HEAD~1'], folder)
      this.postMessage({ type: 'git-op-done', op: 'reset-prev' })
    } catch (e: any) {
      this.postMessage({ type: 'git-error', error: String(e.stderr ?? e.message ?? e) })
    }
    this.postMessage({ type: 'git-busy', busy: false })
  }

  async handleResetRemote(folder: string): Promise<void> {
    const branch = await this.run(['rev-parse', '--abbrev-ref', 'HEAD'], folder).catch(() => '')
    const choice = await vscode.window.showWarningMessage(
      `Сбросить рабочую директорию до состояния origin/${branch}? Все локальные изменения будут потеряны.`,
      { modal: true },
      'Сбросить'
    )
    if (choice !== 'Сбросить') { return }
    this.postMessage({ type: 'git-busy', busy: true })
    try {
      await this.run(['fetch', 'origin'], folder)
      await this.run(['reset', '--hard', `origin/${branch}`], folder)
      this.postMessage({ type: 'git-op-done', op: 'reset-remote' })
    } catch (e: any) {
      this.postMessage({ type: 'git-error', error: String(e.stderr ?? e.message ?? e) })
    }
    this.postMessage({ type: 'git-busy', busy: false })
  }

  private async _promptCommitMessage(folder: string, staged: string): Promise<string | undefined> {
    let suggestion = ''
    if (this.orchestrator) {
      const diffNames = await this.run(['diff', '--cached', '--name-status'], folder).catch(() => staged)
      const req: ChatRequest = {
        conversationId: '__git__',
        messages: [{
          id: `git-${Date.now()}`, role: 'user', createdAt: Date.now(),
          content: `Напиши одну короткую строку — сообщение git-коммита (без кавычек, без точки в конце) для изменений:\n${diffNames}`,
        }],
        context: { taskKind: 'chat' },
        modelId: 'auto',
      }
      await this.orchestrator.streamChatResponse(req, d => { suggestion += d }).catch(() => {})
      suggestion = suggestion.trim().replace(/^["'`]|["'`]$/g, '')
    }

    return vscode.window.showInputBox({
      prompt: 'Сообщение коммита',
      value: suggestion || undefined,
      placeHolder: 'Введите сообщение коммита',
      ignoreFocusOut: true,
    })
  }
}
