import * as net from 'net'
import * as fs from 'fs'
import * as path from 'path'
import * as vscode from 'vscode'

export class NpmService {
  constructor(private readonly postMessage: (msg: unknown) => void) {}

  run(script: string, folder: string): void {
    const cmd = script === 'install' ? 'npm install' : `npm run ${script}`
    let terminal = vscode.window.terminals.find(t => t.name === 'Kludge: npm')
    if (!terminal || terminal.exitStatus !== undefined) {
      terminal = vscode.window.createTerminal({ name: 'Kludge: npm', cwd: folder, shellPath: 'cmd.exe' })
    }
    terminal.show(true)
    terminal.sendText(cmd)

    if (script === 'dev') {
      const ports = this._devPortCandidates(folder)
      this.postMessage({ type: 'dev-polling', ports })
      this._pollForDevServer(ports, folder, 0)
    }
  }

  private _isPortOpen(port: number): Promise<boolean> {
    return new Promise(resolve => {
      const socket = new net.Socket()
      socket.setTimeout(300)
      socket.once('connect', () => { socket.destroy(); resolve(true) })
      socket.once('error',   () => { socket.destroy(); resolve(false) })
      socket.once('timeout', () => { socket.destroy(); resolve(false) })
      socket.connect(port, '127.0.0.1')
    })
  }

  private _devPortCandidates(folder: string): number[] {
    const found: number[] = []
    try {
      for (const name of ['vite.config.ts', 'vite.config.js', 'vite.config.mts']) {
        const cfg = fs.readFileSync(path.join(folder, name), 'utf8')
        const m = cfg.match(/port\s*:\s*(\d+)/)
        if (m) { found.push(parseInt(m[1])); break }
      }
    } catch {}
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(folder, 'package.json'), 'utf8'))
      const m = (pkg.scripts?.dev ?? '').match(/--port[=\s]+(\d+)/)
      if (m) { found.push(parseInt(m[1])) }
    } catch {}
    return found.length ? found : [5173, 3000, 4200, 8080, 3001]
  }

  private _pollForDevServer(ports: number[], folder: string, attempts: number): void {
    if (attempts >= 60) {
      this.postMessage({ type: 'dev-polling-timeout' })
      return
    }
    setTimeout(async () => {
      for (const port of ports) {
        try {
          if (await this._isPortOpen(port)) {
            const url = `http://localhost:${port}`
            this.postMessage({ type: 'dev-server-ready', url })
            await vscode.commands.executeCommand('kludge.openPreviewAt', url)
            return
          }
        } catch (e) {
          console.error('[Kludge] isPortOpen error:', e)
        }
      }
      this._pollForDevServer(ports, folder, attempts + 1)
    }, 1000)
  }
}
