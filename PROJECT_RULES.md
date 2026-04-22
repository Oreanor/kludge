# Project Rules — AIR

Short, actionable rules to keep the codebase consistent for humans and agents.

## Principles
- Design types and contracts first, then services, then UI.
- Any new feature must follow: types → service → provider → ui → command.
- Never hardcode models, providers, or secrets in source files.
- Store secrets in settings, environment variables, or secret storage only.
- All model responses must go through a single orchestrator (no direct UI calls).
- Destructive actions require preview + explicit confirm.
- Use patch/diff workflow for file edits; show diffs to users before applying.

## Architecture
- Single Responsibility per module.
- `extension.ts` only registers commands, providers and services.
- `services/` contains business logic, orchestration, and model integration.
- `webview/` contains UI and message transport only (typed messages).
- `providers/` contain adapters for LLMs, image APIs, icon/preview sources.
- `types/` contains shared interfaces, events and enums.
- No model selection or response-format logic inside React/Vue UI.
- Avoid circular dependencies: UI ↔ service must be decoupled.

## Types and Data
- All messages are discriminated unions (use `type`/`kind` discriminants).
- Entities must include `id`, `createdAt`, and `status` where applicable.
- Request/response models are explicit types, not ad-hoc objects.
- No `any` (except temporary prototypes clearly marked).
- Each agent/tool step has its own event type.
- File references use `Uri` + `Range` (not raw string paths).

## UI Rules
- UI logic should be reactive; avoid imperative DOM hacks.
- Every screen: `loading` / `error` / `empty` / `ready` states.
- Tabs/panels must restore state after reload.
- Preview, chat and icons are separate panels/views.
- Search-first UX for icon/model/preset selection.
- Long lists: use virtualization or pagination.

## Chat / Agent Rules
- Chat receives explicit context (selection, file, workspace root, extra files).
- Send only necessary context to models.
- Prefer streaming responses if provider supports it.
- Agents return structured results: `{text, edits, warnings, errors}`.
- If uncertain, agent must ask clarifying questions.
- Multi-agent mode: each agent has a limited role and scope.
- Humans approve any code changes proposed by agents.

## Code & Patch Workflow
- All edits generated as patches; show unified diff preview before apply.
- Verify file unchanged before applying a patch.
- Do not auto-apply large patches without user confirmation.
- Keep consistent style: formatter + import ordering + naming.
- If many files change, provide a concise plan first.

## Preview & Webview
- Preview logic separated from editor logic.
- Source for preview must be explicit (local static, dev server, iframe).
- Provide fallback/error for server-dependent preview.
- All webviews must use CSP + nonce and typed messages between extension ↔ webview.

## Icons
- Icons searchable by name and have stable IDs.
- Extension inserts imports if icons are embedded in code.
- Support favorites / recently used and offline search via local index.

## Models & Keys
- Each provider behind an adapter.
- Ask user for keys only when necessary; store securely.
- Settings must list models for chat/code/images explicitly.
- No mixing of provider keys in a single setting.
- Auth errors must be human-readable and actionable.
- Provide local/free-tier fallback when possible.

## Quality & Testing
- Each feature has acceptance criteria (happy + error paths).
- New screens have basic tests for state and messaging.
- Log critical errors; do not ship silent failures.
- Build MVP first, then iterate.

## Guidelines for AI-Assisted Development
- Always add or check types/interfaces first for any generated code.
- Do not change public APIs lightly.
- Propose 1–3 safe variants when a task is ambiguous.
- Justify new dependencies and keep them minimal.

## Repo Defaults
- TypeScript `strict` mode enabled.
- ESLint + Prettier enforced.
- No `any` except marked prototyping code.
- One responsibility per file; explicit exported types everywhere.

## Process Rules
- Big work starts with a short plan.
- New features start with: which data types are needed?
- Integrations start with: which adapter and contract?
- UI pieces start with: which states and events?

---
Place this file at the repository root as `PROJECT_RULES.md`.
