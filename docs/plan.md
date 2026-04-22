# План задач для реализации AI-расширения VS Code

Ниже — уже не просто список идей, а спецификация задач для AI-реализации расширения в VS Code: что делать, какие функции/типы нужны, как связаны части, и где нужны ключи/API-данные. Для webview-коммуникации в VS Code нужен `postMessage` с одной стороны и `onDidReceiveMessage` с другой; у Continue chat/agent режимы тоже опираются на отдельный UI и передачу выбранного кода/контекста в чат.

---

## 1. Базовый каркас

### Задача

- Сделать расширение с одним активатором, командным API и централизованным `state/store`.

### Как реализовать

- `activate(context: vscode.ExtensionContext)` регистрирует команды, провайдеры webview и сервисы.
- Создать `src/extension.ts`, `src/types.ts`, `src/services/*`, `src/webview/*`.
- Ввести `ExtensionState`, `SettingsState`, `TaskState`, `ModelConfig`, `ProviderConfig`.
- Все сообщения между UI и extension сделать типизированными через `MessageToWebview` и `MessageFromWebview`.

### Типы

```ts
type ProviderId = 'openai' | 'anthropic' | 'google' | 'ollama' | 'openrouter' | 'custom';
type TaskKind = 'chat' | 'edit' | 'preview' | 'icons' | 'image' | 'search' | 'agent';

interface ModelConfig {
  id: string;
  provider: ProviderId;
  name: string;
  taskKinds: TaskKind[];
  maxTokens?: number;
  temperature?: number;
}

interface ExtensionState {
  activeTaskId?: string;
  selectedModelByTask: Partial<Record<TaskKind, string>>;
  favorites: {
    icons: string[];
    prompts: string[];
  };
}
```

### Требования к AI-реализации

- Не писать логику напрямую в UI без сервиса.
- Не хардкодить провайдера внутри chat component.
- Все новые фичи подключать через команды и message routing.

---

## 2. Чат и агент

### Задача

- Сделать агентское окно как в Cursor/Continue: чат, история, стриминг, контекст, команды, действие над кодом.

### Как реализовать

- Сделать `WebviewViewProvider` или `WebviewPanel` для чата.
- В extension держать `ChatOrchestrator`, который собирает контекст и вызывает LLM.
- Поддержать streaming ответов в UI через incremental delta messages.
- Поддержать типы сообщений: `chat`, `tool_call`, `tool_result`, `error`, `done`.

### Типы

```ts
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  createdAt: number;
  toolName?: string;
}

interface ChatRequest {
  conversationId: string;
  messages: ChatMessage[];
  context: ChatContext;
  modelId: string;
}

interface ChatContext {
  selectedText?: string;
  activeFile?: string;
  workspaceFiles?: string[];
  symbols?: string[];
  taskKind: TaskKind;
}
```

### Функции (примерный набор)

- `createChatProvider(context)`
- `sendChatMessage(request)`
- `streamChatResponse(request, onDelta)`
- `buildChatContext(options)`
- `handleToolCall(call)`

### Важные правила

- Контекст всегда формировать через отдельную функцию.
- Не смешивать UI state и conversation state.
- История должна сохраняться, но без секретов в логах.

---

## 3. Inline edit

### Задача

- Делать правки кода через выделение и diff-preview, а не через прямую запись в файл.

### Как реализовать

- Команда `extension.editSelection`.
- На вход: selected text, file path, instruction.
- На выход: unified diff или structured patch.
- Перед применением показать preview и запросить confirm.

### Типы

```ts
interface EditRequest {
  uri: string;
  selection: vscode.Range;
  instruction: string;
  languageId: string;
}

interface EditPatch {
  uri: string;
  original: string;
  updated: string;
  diff: string;
}
```

### Функции

- `extractSelection(editRequest)`
- `generatePatch(editRequest)`
- `showPatchPreview(patch)`
- `applyPatch(patch)`
- `rejectPatch(patchId)`

### Правила безопасности

- Всегда работать по `uri + range`.
- Перед `apply` повторно проверять, что файл не изменился.
- Если `patch` невалиден, возвращать structured error.

---

## 4. Preview приложения

### Задача

- Сделать отдельную вкладку live preview для фронтенд-приложения, чтобы видеть результат без переключений.

### Как реализовать

- Использовать `WebviewPanel` или отдельный `WebviewView`.
- Источник preview: local dev server, simple browser, iframe, или встроенный HTML shell.
- Добавить автообновление через file watch / manual reload command.

### Типы

```ts
interface PreviewConfig {
  url?: string;
  entryFile?: string;
  devServerPort?: number;
  framework?: 'react' | 'next' | 'vite' | 'svelte' | 'static';
}
```

### Функции

- `openPreviewPanel(config)`
- `detectPreviewUrl(workspace)`
- `reloadPreview()`
- `syncPreviewWithChanges(fileUris)`

### Важные правила

- URL брать из config или автодетекта, а не из UI.
- Для webview настроить `enableScripts` и CSP.
- Если нужен внешний localhost, явно описать это в настройках.

---

## 5. Иконки Lucide

### Задача

- Сделать вкладку с поиском и предпросмотром Lucide React иконок, с вставкой по имени в компонент.

### Как реализовать

- Хранить индекс иконок локально или через `lucide-static`.
- В UI сделать search input, grid preview, favorite list.
- По клику вставлять `import { IconName } from 'lucide-react'` и JSX-usage.
- Добавить команды “copy import”, “copy JSX”, “replace current icon”.

### Типы

```ts
interface IconItem {
  name: string;
  tags?: string[];
  category?: string;
}

interface IconInsertRequest {
  name: string;
  targetUri: string;
  targetRange?: vscode.Range;
  format: 'import' | 'jsx' | 'prop';
}
```

### Функции

- `loadIconIndex()`
- `searchIcons(query)`
- `previewIcon(name)`
- `insertIconByName(request)`
- `replaceIconInSelection(request)`

### Правила

- Проверять, что имя реально есть в индексe.
- Автоматически добавлять импорт, если его нет.
- Не дублировать существующие импорты.

---

## 6. Генерация картинок

### Задача

- Сделать простой `image-generator` tab с минимумом опций и бесплатным fallback.

### Как реализовать

- Отдельная панель с `prompt`, `style preset`, `size`, `aspect ratio`.
- Провайдер через адаптер: `ImageProvider`.
- Поддержка локального/дешёвого режима, если ключ не задан.

### Типы

```ts
interface ImageRequest {
  prompt: string;
  style?: 'realistic' | 'illustration' | 'icon' | 'ui';
  aspectRatio?: '1:1' | '16:9' | '9:16';
  size?: 'small' | 'medium' | 'large';
}

interface ImageProvider {
  generate(request: ImageRequest): Promise<ImageResult>;
}
```

### Функции

- `buildImageRequestFromUI()`
- `generateImage(request)`
- `saveImageArtifact(result)`
- `reusePromptFromHistory()`

### Попросить у пользователя

- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY` или ключ другого image provider.
- Если нужен бесплатный fallback, спросить разрешение на локальную модель/локальный endpoint.

---

## 7. Модельный роутер

### Задача

- Подбирать модель под задачу автоматически: чат, код, картинки, быстрые ответы, тяжёлый reasoning.

### Как реализовать

- Ввести `ModelRouter`.
- Правила маршрутизации по `TaskKind`, размеру контекста, бюджету, latency.
- Поддержать ручной override в настройках.

### Типы

```ts
interface RouteDecision {
  modelId: string;
  reason: string;
  fallbackModelId?: string;
}

interface ModelRouter {
  route(task: TaskKind, context: ChatContext): RouteDecision;
}
```

### Функции

- `registerModels(configs)`
- `routeTask(taskKind, context)`
- `chooseFallback(primary, error)`
- `showModelPicker()`

### Попросить у пользователя

- Ключи провайдеров.
- Предпочтение: `low-cost`, `balanced`, `best-quality`.
- Разрешение сохранять выбранные модели в settings.

---

## 8. Multi-agent оркестрация

### Задача

- Сделать несколько специализированных агентов: `planner`, `coder`, `reviewer`, `fixer`.

### Как реализовать

- Один orchestrator запускает chain of roles.
- Каждый агент получает ограниченный scope и toolset.
- Результат каждого шага сохранять в task state.

### Типы

```ts
type AgentRole = 'planner' | 'coder' | 'reviewer' | 'fixer';

interface AgentTask {
  id: string;
  role: AgentRole;
  input: string;
  status: 'queued' | 'running' | 'done' | 'failed';
}
```

### Функции

- `runPlanner(task)`
- `runCoder(task)`
- `runReviewer(task)`
- `runFixer(task)`
- `mergeAgentResults(results)`

### Правила

- У каждого агента должен быть свой prompt.
- Нельзя давать `coder` полный write-access без review для risky tasks.
- Сделать cancellation token.

---

## 9. Что попросить у пользователя (UI setup wizard)

- `OPENAI_API_KEY` или другой LLM key.
- `ANTHROPIC_API_KEY`, если нужна сильная модель для code/chat.
- `OPENROUTER_API_KEY`, если нужен роутинг по множеству моделей.
- `IMAGE_PROVIDER_API_KEY`, если подключаешь внешний генератор изображений.
- `LOCAL_MODEL_ENDPOINT`, если будет Ollama/локальный сервер.
- `APP_PREVIEW_URL` или порт dev-сервера.
- Разрешение на сохранение preferences: модели, пресеты, favorites.

---

## 10. Порядок разработки (примерный roadmap)

- [ ] Скелет extension + типы + commands.
- [ ] Chat panel + message transport.
- [ ] Context extraction + selection send.
- [ ] Edit pipeline + diff preview.
- [ ] Preview panel.
- [ ] Icon browser.
- [ ] Model router.
- [ ] Image generator.
- [ ] Multi-agent mode.
- [ ] Settings wizard и onboarding.

---

## 11. Что важно для AI-исполнителя (рекомендации)

- Всегда сначала вводить типы и контракты, потом UI.
- Для каждой фичи делать `service -> provider -> ui`.
- Не писать код без проверки сообщений/типов.
- Если чего-то не хватает, сначала добавить `config/type`, потом реализацию.
- Не оставлять “магические строки” в message bus.

---

_Автоматически сгенерировано из `docs/plan.txt`, сохранено как `docs/plan.md`._
