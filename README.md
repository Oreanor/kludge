# Kludge Code

**AI coding assistant built into VS Code — chat, edit, preview, git, and automation in one sidebar panel.**

Kludge Code connects to the AI providers you already use (or run locally) and embeds a full-featured chat interface directly into VS Code. No web tabs, no copy-pasting — just a sidebar where you talk to your code.

[Русский](README.ru.md) · [Português](README.pt.md)

---

## Features

### Multi-provider AI — your keys, your choice

Connect any combination of 8 providers simultaneously. Kludge picks the best available model automatically, or you choose one from the dropdown.

| Provider | Models |
|---|---|
| Google Gemini | Gemini 2.0 Flash, Gemini 1.5 Pro/Flash |
| Anthropic | Claude 3.5 Sonnet, Claude 3 Haiku |
| OpenAI | GPT-4o, GPT-4o Mini |
| Groq | Llama 3, Mixtral (ultra-fast inference) |
| OpenRouter | Any model via unified API |
| DeepSeek | DeepSeek Chat, DeepSeek Coder |
| Mistral | Mistral Large, Codestral |
| Ollama | Any local model running on your machine |

API keys are stored in VS Code's encrypted `SecretStorage` — never in plain text.

---

### Workspace-aware chat

Every message is enriched with context automatically:

- **Active file** — the file you're editing is always in context
- **Workspace file list** — the AI knows what files exist in your project
- **Scope selector** — narrow context to a specific file, folder, or the whole project
- **Two-pass file reading** — if the AI needs to see a file's contents, it requests them and receives a second-pass answer with the actual code, avoiding token waste on files that aren't relevant

---

### Multiple chat sessions

Work on several tasks in parallel without losing history. Each session is a tab at the top of the panel — create, switch, and close them independently. One session can be streaming while you read another. A busy-indicator dot marks any session that is currently waiting for a response.

---

### Snapshot & restore

Before every message you send, Kludge silently snapshots all open workspace files. If the AI's response goes in the wrong direction, click the **↩** button next to any past message to restore your files to exactly the state they were in before that request — no git required, no stash, no branch switching.

Up to 15 snapshots are kept in VS Code's global state.

---

### Quick prompts

One-click actions for common tasks. Built-in prompts include refactor, explain, write tests, and more. You can create your own:

- Pick a **prompt** from the dropdown
- Pick a **scope** (active file / folder / whole project)
- Hit **＋** to run immediately, or switch to **Task** mode to schedule it for later

Custom prompts are saved in VS Code settings (`kludge.customPrompts`) and sync across machines via Settings Sync.

---

### Scheduled prompts

Need the AI to run a task at a specific time — a morning standup summary, a nightly build check, a reminder to clean up a branch? Schedule any prompt using the built-in calendar:

- Pick date and time with a datetime picker
- The calendar view shows pending tasks as **blue dots** and completed ones as grey dots
- Click any day to see its scheduled tasks with times and previews
- Tasks survive VS Code restarts — they're restored and re-armed on activation
- Cancel any pending task with one click

---

### Git panel

A compact git toolbar lives in the input area:

| Button | Action |
|---|---|
| Branch dropdown | Switch branches or create a new one inline |
| Commit | AI generates the commit message automatically |
| Push | Commit + push in one click |
| ↩prev | `git reset --hard HEAD~1` |
| ↩remote | `git fetch && git reset --hard origin/<branch>` |
| Init | Run `git init` if the workspace isn't a repo yet |

The AI can also trigger git operations autonomously. When you ask it to "commit this" or "push the changes", it embeds hidden `<vscode-cmd>` tags in its response that are executed automatically and stripped from the chat display.

---

### npm scripts

Run any `package.json` script directly from the panel. The script list is auto-detected from your workspace. Output streams to the VS Code terminal.

---

### Live preview with element picker

Open your running dev server (Vite, Next.js, React, Angular, Vue) in a side panel without leaving VS Code:

- **Auto-detects** common ports (5173, 3000, 4200, 8080 …) — if multiple are open, you pick from a list
- A transparent proxy injects a bridge script into every page load
- **Element picker** — click any element in the preview and its selector, tag, dimensions, and computed styles are captured and inserted as a chip in your chat input — perfect for targeted style edits
- **Runtime error auto-fix** — when a `console.error` fires in the preview, Kludge automatically sends the error and stack trace to the AI and streams a fix suggestion into chat
- **Hot-reload** on file save

---

### Telegram bot integration

Control your assistant from your phone. Connect a Telegram bot token and chat ID, and a dedicated **Telegram** session tab appears in the sidebar:

- Messages you send via Telegram appear in the tab in real time
- The AI responds and the reply is sent back to Telegram automatically
- Token is stored in VS Code's encrypted secret storage; displayed as `••••••••••••`
- The connect button stays disabled until you actually change the configuration

---

### Markdown rendering

AI responses render as formatted markdown — fenced code blocks, bullet lists, bold, blockquotes, inline code. Code blocks are **collapsible**: long snippets are folded by default and expand on click, keeping the chat readable even after large diffs.

---

### Provider management panel

Add, remove, enable, or disable any provider without leaving VS Code:

- Keys display masked (`••••••••••••`)
- Removing a key enters a **pending state** — the key is shown greyed out with a Restore button until the session ends, so accidental removals are recoverable
- Disabling a provider excludes all its models from the auto-selection without deleting the key

---

## Getting started

1. Install the extension
2. Open the **Kludge Code** panel in the Activity Bar (flame icon)
3. Expand **Providers** and add at least one API key
4. Start chatting

To use Ollama: install it locally, start it, and add `http://localhost:11434` as the Ollama URL — no API key needed.

---

## Commands

| Command | Description |
|---|---|
| `Kludge Code: Open Preview` | Open the live preview panel beside the editor |
| `Kludge Code: Reload Preview` | Reload the current preview page |
| `Kludge Code: Pick Element` | Start the UI element picker in the preview |

---

## Settings

| Setting | Type | Description |
|---|---|---|
| `kludge.customPrompts` | array | Custom quick prompts shown in the action dropdown. Each item needs `label` (shown in UI) and `text` (sent to the model). |

```json
"kludge.customPrompts": [
  {
    "label": "Write tests",
    "text": "Write comprehensive unit tests for the selected file. Use the same test framework already present in the project."
  },
  {
    "label": "Security review",
    "text": "Review this code for security vulnerabilities. Check for injection, auth issues, unsafe deserialization, and other OWASP top 10 risks."
  }
]
```

---

## Requirements

- VS Code 1.116+
- At least one AI provider API key, **or** Ollama running locally
