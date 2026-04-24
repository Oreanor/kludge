import { Message, PickedElement, ModelOption, FolderItem, CustomPrompt, ScheduledTaskInfo, ProviderInfo, Session, STREAMING_ID } from '../types'

export interface AppState {
  msgs: Record<string, Message[]>      // per-session message storage
  messages: Message[]                  // = msgs[activeSessionId] ?? []
  isStreaming: boolean                 // = active session has STREAMING_ID
  busySessionId: string | null        // any session currently streaming
  sessions: Session[]
  activeSessionId: string
  pickedElement: PickedElement | null
  locale: string
  models: ModelOption[]
  disabledProviders: string[]
  selectedModel: string
  npmScripts: string[]
  selectedScript: string
  gitBranch: string
  gitBranches: string[]
  gitBusy: boolean
  newBranchMode: boolean
  newBranchName: string
  selectedPrompt: string
  selectedScope: string
  scopeFolders: FolderItem[]
  activeFile: string | null
  workspaceRoot: string | null
  input: string
  customPrompts: CustomPrompt[]
  newPromptMode: boolean
  scheduledTasks: ScheduledTaskInfo[]
  calendarOpen: boolean
  providers: ProviderInfo[]
  providersOpen: boolean
  telegramConfigured: boolean
  telegramSettingsOpen: boolean
  telegramChatId: string
}

export type AppAction =
  | { type: 'SET_LOCALE'; locale: string }
  | { type: 'SET_MODELS'; models: ModelOption[]; disabledProviders?: string[] }
  | { type: 'SET_PROVIDERS'; providers: ProviderInfo[]; disabledProviders?: string[] }
  | { type: 'SET_SESSIONS'; sessions: Session[]; activeSessionId?: string; busySessionId?: string | null }
  | { type: 'SWITCH_SESSION'; sessionId: string }
  | { type: 'SET_MODEL'; modelId: string }
  | { type: 'SET_NPM_SCRIPTS'; scripts: string[] }
  | { type: 'SET_SELECTED_SCRIPT'; script: string }
  | { type: 'SET_GIT_INFO'; branch: string; branches: string[] }
  | { type: 'SET_GIT_BUSY'; busy: boolean }
  | { type: 'SET_NEW_BRANCH_MODE'; active: boolean }
  | { type: 'SET_NEW_BRANCH_NAME'; name: string }
  | { type: 'SET_SELECTED_PROMPT'; key: string }
  | { type: 'SET_SELECTED_SCOPE'; scope: string }
  | { type: 'SET_WORKSPACE_TREE'; root: string | null; folders: FolderItem[] }
  | { type: 'SET_ACTIVE_FILE'; relativePath: string | null }
  | { type: 'SET_PICKED_ELEMENT'; element: PickedElement | null }
  | { type: 'SET_INPUT'; value: string }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'STREAM_START';   conversationId?: string }
  | { type: 'STREAM_DELTA';   delta: string; conversationId?: string }
  | { type: 'STREAM_DONE';    conversationId?: string }
  | { type: 'STREAM_STOPPED'; conversationId?: string }
  | { type: 'STREAM_ERROR';   error: string; conversationId?: string }
  | { type: 'USER_MESSAGE_SENT'; displayText: string; ts: number }
  | { type: 'EXT_USER_MESSAGE'; text: string; source: Message['source']; conversationId?: string }
  | { type: 'SET_TELEGRAM_CONFIG'; configured: boolean; chatId?: string }
  | { type: 'TOGGLE_TELEGRAM_SETTINGS' }
  | { type: 'RESPONSE'; text: string }
  | { type: 'ADD_MESSAGE'; id: string; text: string }
  | { type: 'UPDATE_OR_ADD_MESSAGE'; id: string; text: string }
  | { type: 'HISTORY_LOADED'; messages: Message[]; conversationId?: string }
  | { type: 'SET_CUSTOM_PROMPTS'; prompts: CustomPrompt[] }
  | { type: 'SET_NEW_PROMPT_MODE'; active: boolean }
  | { type: 'SET_SCHEDULED_TASKS'; tasks: ScheduledTaskInfo[] }
  | { type: 'TOGGLE_CALENDAR' }
  | { type: 'PATCH_LAST_MESSAGE'; text: string }
  | { type: 'TOGGLE_PROVIDERS' }

export const initialState: AppState = {
  msgs: { default: [] },
  messages: [],
  isStreaming: false,
  busySessionId: null,
  sessions: [{ id: 'default', name: 'Chat 1', createdAt: 0 }],
  activeSessionId: 'default',
  pickedElement: null,
  locale: 'en',
  models: [],
  disabledProviders: [],
  selectedModel: 'auto',
  npmScripts: [],
  selectedScript: 'build',
  gitBranch: '',
  gitBranches: [],
  gitBusy: false,
  newBranchMode: false,
  newBranchName: '',
  selectedPrompt: 'refactor',
  selectedScope: 'file',
  scopeFolders: [],
  activeFile: null,
  workspaceRoot: null,
  input: '',
  customPrompts: [],
  newPromptMode: false,
  scheduledTasks: [],
  calendarOpen: false,
  providers: [],
  providersOpen: false,
  telegramConfigured: false,
  telegramSettingsOpen: false,
  telegramChatId: '',
}

// Apply a message update to a specific session, keeping derived fields in sync.
function applyMsgs(
  state: AppState,
  sessionId: string,
  fn: (m: Message[]) => Message[],
): AppState {
  const prev = state.msgs[sessionId] ?? []
  const next = fn(prev)
  const msgs = { ...state.msgs, [sessionId]: next }
  const messages = msgs[state.activeSessionId] ?? []
  const isStreaming = messages.some(m => m.id === STREAMING_ID)
  const busySessionId = Object.keys(msgs).find(id => (msgs[id] ?? []).some(m => m.id === STREAMING_ID)) ?? null
  return { ...state, msgs, messages, isStreaming, busySessionId }
}

export function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {

    // ── non-message actions ─────────────────────────────────────────────────

    case 'SET_LOCALE': return { ...state, locale: action.locale }

    case 'SET_MODELS': {
      const dp = action.disabledProviders ?? state.disabledProviders
      const selectedProvider = state.models.find(m => m.id === state.selectedModel)?.provider ?? ''
      const selected = selectedProvider && dp.includes(selectedProvider) ? 'auto' : state.selectedModel
      return { ...state, models: action.models, disabledProviders: dp, selectedModel: selected }
    }

    case 'SET_PROVIDERS': {
      const dp = action.disabledProviders ?? state.disabledProviders
      return { ...state, providers: action.providers, disabledProviders: dp }
    }

    case 'TOGGLE_PROVIDERS': return { ...state, providersOpen: !state.providersOpen }

    case 'SET_TELEGRAM_CONFIG':
      return { ...state, telegramConfigured: action.configured, telegramSettingsOpen: !action.configured, telegramChatId: action.chatId ?? state.telegramChatId }
    case 'TOGGLE_TELEGRAM_SETTINGS': return { ...state, telegramSettingsOpen: !state.telegramSettingsOpen }

    case 'SET_MODEL': return { ...state, selectedModel: action.modelId }

    case 'SET_NPM_SCRIPTS': {
      const preferred = ['dev', 'build', 'start']
      const def = preferred.find(s => action.scripts.includes(s)) ?? action.scripts[0]
      return { ...state, npmScripts: action.scripts, selectedScript: def ?? state.selectedScript }
    }

    case 'SET_SELECTED_SCRIPT':    return { ...state, selectedScript: action.script }
    case 'SET_GIT_INFO':           return { ...state, gitBranch: action.branch, gitBranches: action.branches }
    case 'SET_GIT_BUSY':           return { ...state, gitBusy: action.busy }
    case 'SET_NEW_BRANCH_MODE':    return { ...state, newBranchMode: action.active, newBranchName: action.active ? state.newBranchName : '' }
    case 'SET_NEW_BRANCH_NAME':    return { ...state, newBranchName: action.name }
    case 'SET_SELECTED_PROMPT':    return { ...state, selectedPrompt: action.key }
    case 'SET_SELECTED_SCOPE':     return { ...state, selectedScope: action.scope }
    case 'SET_WORKSPACE_TREE':     return { ...state, workspaceRoot: action.root, scopeFolders: action.folders }
    case 'SET_ACTIVE_FILE':        return { ...state, activeFile: action.relativePath }
    case 'SET_PICKED_ELEMENT':     return { ...state, pickedElement: action.element }
    case 'SET_INPUT':              return { ...state, input: action.value }
    case 'SET_CUSTOM_PROMPTS':     return { ...state, customPrompts: action.prompts }
    case 'SET_NEW_PROMPT_MODE':    return { ...state, newPromptMode: action.active }
    case 'SET_SCHEDULED_TASKS':    return { ...state, scheduledTasks: action.tasks }
    case 'TOGGLE_CALENDAR':        return { ...state, calendarOpen: !state.calendarOpen }

    // ── sessions ────────────────────────────────────────────────────────────

    case 'SET_SESSIONS': {
      const busySessionId = action.busySessionId !== undefined ? action.busySessionId : state.busySessionId
      // Don't override if user is on a virtual tab (e.g. 'telegram') that isn't in the sessions list
      const currentIsVirtual = !action.sessions.some(s => s.id === state.activeSessionId)
      const nextActiveId = currentIsVirtual ? state.activeSessionId : (action.activeSessionId ?? state.activeSessionId)
      if (nextActiveId === state.activeSessionId) {
        return { ...state, sessions: action.sessions, busySessionId }
      }
      // Active session changed (backend-driven, e.g. on panel reload)
      const msgs = { ...state.msgs, [state.activeSessionId]: state.messages }
      const messages = msgs[nextActiveId] ?? []
      const isStreaming = messages.some(m => m.id === STREAMING_ID)
      return { ...state, sessions: action.sessions, msgs, activeSessionId: nextActiveId, messages, isStreaming, busySessionId }
    }

    case 'SWITCH_SESSION': {
      if (action.sessionId === state.activeSessionId) { return state }
      // Save current messages before switching
      const msgs = { ...state.msgs, [state.activeSessionId]: state.messages }
      const messages = msgs[action.sessionId] ?? []
      const isStreaming = messages.some(m => m.id === STREAMING_ID)
      return { ...state, msgs, activeSessionId: action.sessionId, messages, isStreaming }
    }

    // ── message actions (always target active session) ──────────────────────

    case 'CLEAR_MESSAGES':
      return applyMsgs(state, state.activeSessionId, () => [])

    case 'USER_MESSAGE_SENT':
      return applyMsgs(state, state.activeSessionId, msgs => [
        ...msgs,
        { id: `user-${action.ts}`, role: 'user', text: action.displayText },
        { id: STREAMING_ID, role: 'assistant', text: '' },
      ])

    case 'EXT_USER_MESSAGE':
      return applyMsgs(state, action.conversationId ?? state.activeSessionId, msgs => [
        ...msgs,
        { id: `ext-user-${Date.now()}`, role: 'user', text: action.text, source: action.source },
        { id: STREAMING_ID, role: 'assistant', text: '' },
      ])

    case 'ADD_MESSAGE':
      return applyMsgs(state, state.activeSessionId, msgs => [
        ...msgs,
        { id: action.id, role: 'assistant', text: action.text },
      ])

    case 'UPDATE_OR_ADD_MESSAGE':
      return applyMsgs(state, state.activeSessionId, msgs => {
        const idx = msgs.findIndex(m => m.id === action.id)
        if (idx !== -1) {
          const next = [...msgs]
          next[idx] = { ...next[idx], text: action.text }
          return next
        }
        return [...msgs, { id: action.id, role: 'assistant', text: action.text }]
      })

    case 'RESPONSE':
      return applyMsgs(state, state.activeSessionId, msgs => {
        const newMsg: Message = { id: `msg-${Date.now()}`, role: 'assistant', text: action.text }
        const idx = msgs.findIndex(m => m.id === STREAMING_ID)
        return idx !== -1 ? msgs.map((m, i) => i === idx ? newMsg : m) : [...msgs, newMsg]
      })

    case 'PATCH_LAST_MESSAGE':
      return applyMsgs(state, state.activeSessionId, msgs => {
        const idx = [...msgs].map((m, i) => ({ m, i })).reverse()
          .find(({ m }) => m.role === 'assistant' && m.id !== STREAMING_ID)?.i ?? -1
        if (idx === -1) { return msgs }
        const next = [...msgs]
        next[idx] = { ...next[idx], text: action.text }
        return next
      })

    // ── stream actions (routed by conversationId) ───────────────────────────

    case 'STREAM_START': {
      const sid = action.conversationId ?? state.activeSessionId
      return applyMsgs(state, sid, msgs =>
        msgs.some(m => m.id === STREAMING_ID)
          ? msgs
          : [...msgs, { id: STREAMING_ID, role: 'assistant', text: '' }]
      )
    }

    case 'STREAM_DELTA': {
      const sid = action.conversationId ?? state.activeSessionId
      return applyMsgs(state, sid, msgs =>
        msgs.map(m => m.id === STREAMING_ID ? { ...m, text: m.text + action.delta } : m)
      )
    }

    case 'STREAM_DONE': {
      const sid = action.conversationId ?? state.activeSessionId
      return applyMsgs(state, sid, msgs =>
        msgs.map(m => m.id === STREAMING_ID ? { ...m, id: `msg-${Date.now()}` } : m)
      )
    }

    case 'STREAM_STOPPED': {
      const sid = action.conversationId ?? state.activeSessionId
      return applyMsgs(state, sid, msgs => msgs.filter(m => m.id !== STREAMING_ID))
    }

    case 'STREAM_ERROR': {
      const sid = action.conversationId ?? state.activeSessionId
      return applyMsgs(state, sid, msgs => [
        ...msgs.filter(m => m.id !== STREAMING_ID),
        { id: `err-${Date.now()}`, role: 'assistant', text: `⚠ ${action.error}` },
      ])
    }

    case 'HISTORY_LOADED': {
      const sid = action.conversationId ?? state.activeSessionId
      if (action.messages.length === 0) { return state }
      // Only load if the session doesn't already have real messages (don't overwrite in-progress work)
      const existing = state.msgs[sid] ?? []
      if (existing.some(m => m.id !== STREAMING_ID && m.text)) { return state }
      return applyMsgs(state, sid, () => action.messages)
    }

    default:
      return state
  }
}
