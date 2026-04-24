import * as vscode from 'vscode';
import { ChatProvider } from './chatProvider';
import { ChatOrchestrator, HistoryService, PreviewPanel } from './services';
import { ChatRequest } from './types';
import { listWorkspaceFiles } from './utils/vscodeCmd';

export async function activate(context: vscode.ExtensionContext) {
  const historyService = new HistoryService(context.globalState);
  const orchestrator = new ChatOrchestrator(historyService);
  const provider = new ChatProvider(context.extensionUri, context.globalState, context.secrets, orchestrator);
  await provider.loadProviderKeys();
  await provider.loadTelegramConfig();
  void provider.restoreScheduledTasks();
  const preview = new PreviewPanel();

  // ── подписка на ошибки из preview → авто-фикс через AI ───────────────
  preview.subscribeToErrors(async (errorMsg, stack) => {
    const workspaceFiles = await listWorkspaceFiles();
    const activeEditor = vscode.window.activeTextEditor;
    const request: ChatRequest = {
      conversationId: 'preview-autofix',
      messages: [{
        id: `err-${Date.now()}`,
        role: 'user',
        content: `Runtime ошибка в приложении:\n${errorMsg}\n\nStack: ${stack}\n\nПредложи фикс.`,
        createdAt: Date.now()
      }],
      context: {
        taskKind: 'agent',
        workspaceFiles,
        activeFile: activeEditor?.document.fileName,
        activeFileContent: activeEditor?.document.getText() ?? '',
      },
      modelId: 'default'
    };

    await orchestrator.streamChatResponse(request, delta => {
      provider.postMessage({ type: 'delta', delta, conversationId: 'preview-autofix' });
    });
    provider.postMessage({ type: 'done', conversationId: 'preview-autofix' });
  });

  // ── element picker из preview → чип в инпуте webview ────────────────
  preview.subscribeToElementPicks(async (info) => {
    await provider.postMessageWhenReady({ type: 'picked-element', data: info });
    provider.postMessage({ type: 'picker-done' });
  });

  context.subscriptions.push(
    vscode.commands.registerCommand('kludge.openPreview', () => preview.open()),
    vscode.commands.registerCommand('kludge.openPreviewAt', (url: string) => preview.open(url)),
    vscode.commands.registerCommand('kludge.reloadPreview', () => preview.reload()),
    vscode.commands.registerCommand('kludge.pickElement', () => preview.startElementPicker()),
    vscode.commands.registerCommand('kludge.stopPicker', () => preview.stopElementPicker()),
    vscode.workspace.onDidSaveTextDocument(() => preview.reload())
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ChatProvider.viewId,
      provider
    )
  );
}

export function deactivate() {}
