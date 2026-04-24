import * as vscode from 'vscode';

const CMD_RE = /<vscode-cmd>([\s\S]*?)<\/vscode-cmd>/g;

export function extractCmds(text: string): Array<Record<string, any>> {
  const cmds: Array<Record<string, any>> = [];
  let m: RegExpExecArray | null;
  CMD_RE.lastIndex = 0;
  while ((m = CMD_RE.exec(text)) !== null) {
    try { cmds.push(JSON.parse(m[1])); } catch {}
  }
  return cmds;
}

export function stripCmds(text: string): string {
  return text.replace(/<vscode-cmd>[\s\S]*?<\/vscode-cmd>/g, '').trim();
}

export async function listWorkspaceFiles(): Promise<string[]> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) { return []; }
  const files: string[] = [];
  for (const folder of folders) {
    const entries = await vscode.workspace.findFiles(
      new vscode.RelativePattern(folder, '**/*'),
      '**/{node_modules,.git,dist,out,build,.next}/**',
      200
    );
    for (const uri of entries) {
      files.push(vscode.workspace.asRelativePath(uri, false));
    }
  }
  return files;
}
