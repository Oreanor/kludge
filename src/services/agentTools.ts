import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ── определения инструментов для Anthropic API ────────────────────────────

export const TOOLS = [
  {
    name: 'read_file',
    description: 'Читает содержимое файла из рабочего пространства',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Путь к файлу относительно корня проекта' }
      },
      required: ['path']
    }
  },
  {
    name: 'list_files',
    description: 'Показывает список файлов в директории',
    input_schema: {
      type: 'object',
      properties: {
        dir: { type: 'string', description: 'Директория, по умолчанию корень проекта' }
      },
      required: []
    }
  },
  {
    name: 'write_file',
    description: 'Записывает содержимое в файл. ВСЕГДА требует подтверждения пользователя перед записью.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Путь к файлу' },
        content: { type: 'string', description: 'Новое содержимое файла' },
        description: { type: 'string', description: 'Что именно меняется и зачем' }
      },
      required: ['path', 'content', 'description']
    }
  },
  {
    name: 'run_terminal',
    description: 'Выполняет команду в терминале. Требует подтверждения.',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Команда для выполнения' },
        description: { type: 'string', description: 'Что делает команда' }
      },
      required: ['command', 'description']
    }
  },
  {
    name: 'get_diagnostics',
    description: 'Получает ошибки и предупреждения TypeScript/ESLint из VS Code',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Путь к файлу, или пусто для всего проекта' }
      },
      required: []
    }
  }
] as const;

// ── выполнение инструментов ───────────────────────────────────────────────

export async function executeTool(
  name: string,
  input: Record<string, string>,
  workspaceRoot: string,
  onConfirm: (msg: string) => Promise<boolean>
): Promise<string> {

  switch (name) {

    case 'read_file': {
      const fullPath = path.join(workspaceRoot, input.path);
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        return `Содержимое ${input.path}:\n\`\`\`\n${content}\n\`\`\``;
      } catch (e) {
        return `Ошибка чтения файла: ${e}`;
      }
    }

    case 'list_files': {
      const dir = path.join(workspaceRoot, input.dir ?? '');
      try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        const list = items
          .filter(i => !i.name.startsWith('.') && i.name !== 'node_modules')
          .map(i => (i.isDirectory() ? `📁 ${i.name}/` : `📄 ${i.name}`))
          .join('\n');
        return `Файлы в ${input.dir || '.'}:\n${list}`;
      } catch (e) {
        return `Ошибка чтения директории: ${e}`;
      }
    }

    case 'write_file': {
      const fullPath = path.join(workspaceRoot, input.path);

      // 1. Читаем оригинал (если файл существует)
      let original = '';
      try { original = fs.readFileSync(fullPath, 'utf8'); } catch {}

      // 2. Пишем предлагаемый контент во временный файл
      const ext = path.extname(input.path) || '.txt';
      const tmpPath = path.join(os.tmpdir(), `air-proposed-${Date.now()}${ext}`);
      fs.writeFileSync(tmpPath, input.content, 'utf8');
      const tmpUri = vscode.Uri.file(tmpPath);

      // 3. Открываем diff: слева оригинал, справа предлагаемое
      const originalUri = vscode.Uri.file(fullPath);
      const diffTitle = `Kludge: ${path.basename(input.path)} — ${input.description}`;

      if (original) {
        // Файл существует — показываем настоящий diff
        await vscode.commands.executeCommand(
          'vscode.diff',
          originalUri,
          tmpUri,
          diffTitle
        );
      } else {
        // Новый файл — просто открываем предлагаемое содержимое
        const doc = await vscode.workspace.openTextDocument(tmpUri);
        await vscode.window.showTextDocument(doc, { preview: true });
      }

      // 4. Диалог подтверждения ПОСЛЕ того как diff открыт
      const choice = await vscode.window.showInformationMessage(
        `Применить изменения в ${input.path}?\n${input.description}`,
        { modal: true },
        'Применить',
        'Отклонить'
      );

      // 5. Закрываем diff вкладку
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

      // 6. Удаляем временный файл
      try { fs.unlinkSync(tmpPath); } catch {}

      if (choice !== 'Применить') {
        return `Пользователь отклонил изменения в ${input.path}.`;
      }

      // 7. Записываем файл только после подтверждения
      try {
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, input.content, 'utf8');

        // Открываем обновлённый файл в редакторе
        const doc = await vscode.workspace.openTextDocument(fullPath);
        await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: true });

        return `Файл ${input.path} успешно обновлён.`;
      } catch (e) {
        return `Ошибка записи файла: ${e}`;
      }
    }

    case 'run_terminal': {
      const confirmed = await onConfirm(
        `Агент хочет выполнить команду:\n\`${input.command}\`\n\n${input.description}`
      );
      if (!confirmed) {return 'Пользователь отклонил выполнение команды.';}

      const terminal = vscode.window.createTerminal('Kludge Agent');
      terminal.show();
      terminal.sendText(input.command);
      return `Команда отправлена в терминал: ${input.command}`;
    }

    case 'get_diagnostics': {
      const uri = input.path
        ? vscode.Uri.file(path.join(workspaceRoot, input.path))
        : undefined;

      const diags = uri
        ? vscode.languages.getDiagnostics(uri)
        : vscode.languages.getDiagnostics();

      if (!diags || (Array.isArray(diags) && diags.length === 0)) {
        return 'Ошибок не найдено.';
      }

      // getDiagnostics() без аргументов возвращает [uri, diag[]][]
      const lines: string[] = [];
      if (uri) {
        const list = diags as vscode.Diagnostic[];
        list.forEach(d => {
          lines.push(`${d.severity === 0 ? '❌' : '⚠'} ${d.message} (строка ${d.range.start.line + 1})`);
        });
      } else {
        const list = diags as [vscode.Uri, vscode.Diagnostic[]][];
        list.forEach(([u, ds]) => {
          ds.forEach(d => {
            const rel = path.relative(workspaceRoot, u.fsPath);
            lines.push(`${d.severity === 0 ? '❌' : '⚠'} ${rel}:${d.range.start.line + 1} — ${d.message}`);
          });
        });
      }

      return lines.slice(0, 30).join('\n');
    }

    default:
      return `Неизвестный инструмент: ${name}`;
  }
}
