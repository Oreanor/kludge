export interface I18n {
  btnSend: string
  btnStop: string
  btnPreview: string
  btnClear: string
  btnAdd: string
  btnCommit: string
  btnPush: string
  modelAuto: string
  branchNew: string
  branchPlaceholder: string
  emptyTitle: string
  emptyHint: string
  placeholder: string
  placeholderStreaming: string
  msgGitProgress: (op: 'add' | 'commit' | 'push') => string
  msgGitAdded: string
  msgGitCommitted: (msg?: string) => string
  msgGitPushed: (msg?: string) => string
  msgGitError: (err: string) => string
  msgNpmStarted: (cmd: string) => string
  msgDevWaiting: (ports: string) => string
  msgDevReady: (url: string) => string
  msgDevTimeout: string
}

const en: I18n = {
  btnSend: 'Send',
  btnStop: '⏹ Stop',
  btnPreview: '⬡ Preview',
  btnClear: '✕ Clear',
  btnAdd: '＋ Add',
  btnCommit: '✓ Commit',
  btnPush: '⬆ Push',
  modelAuto: '⚡ Auto',
  branchNew: '＋ New branch…',
  branchPlaceholder: 'branch name',
  emptyTitle: 'AIR is ready',
  emptyHint: 'Enter — send · Shift+Enter — new line',
  placeholder: 'Write a message…',
  placeholderStreaming: 'Generating… press Stop to edit',
  msgGitProgress: op => ({ add: '⏳ Running `git add -A`…', commit: '⏳ Running add + commit…', push: '⏳ Running add + commit + push…' }[op]),
  msgGitAdded: '✓ Staged all changes (`git add -A`)',
  msgGitCommitted: msg => msg ? `✓ Committed: "${msg}"` : '✓ Committed',
  msgGitPushed: msg => msg ? `✓ Committed "${msg}" and pushed to remote` : '✓ Pushed to remote',
  msgGitError: err => `⚠ Git: ${err}`,
  msgNpmStarted: cmd => `▶ Running \`${cmd}\`…`,
  msgDevWaiting: ports => `🚀 Started \`npm run dev\`, waiting for server… (ports: ${ports})`,
  msgDevReady: url => `🚀 Server is up → ${url} · opening preview`,
  msgDevTimeout: '⚠ Server not found after 60s — open preview manually (⬡)',
}

const ru: I18n = {
  btnSend: 'Отправить',
  btnStop: '⏹ Стоп',
  btnPreview: '⬡ Превью',
  btnClear: '✕ Очистить',
  btnAdd: '＋ Add',
  btnCommit: '✓ Commit',
  btnPush: '⬆ Push',
  modelAuto: '⚡ Авто',
  branchNew: '＋ Новая ветка…',
  branchPlaceholder: 'имя ветки',
  emptyTitle: 'AIR готов к работе',
  emptyHint: 'Enter — отправить · Shift+Enter — перенос строки',
  placeholder: 'Напиши сообщение…',
  placeholderStreaming: 'Генерация… нажми Стоп чтобы изменить запрос',
  msgGitProgress: op => ({ add: '⏳ Выполняю `git add -A`…', commit: '⏳ Выполняю add + commit…', push: '⏳ Выполняю add + commit + push…' }[op]),
  msgGitAdded: '✓ Добавил все изменения в индекс (`git add -A`)',
  msgGitCommitted: msg => msg ? `✓ Закоммитил: «${msg}»` : '✓ Закоммитил',
  msgGitPushed: msg => msg ? `✓ Закоммитил «${msg}» и запушил на remote` : '✓ Запушил на remote',
  msgGitError: err => `⚠ Git: ${err}`,
  msgNpmStarted: cmd => `▶ Запускаю \`${cmd}\`…`,
  msgDevWaiting: ports => `🚀 Запустил \`npm run dev\`, жду сервер… (порты: ${ports})`,
  msgDevReady: url => `🚀 Сервер поднялся → ${url} · открываю превью`,
  msgDevTimeout: '⚠ Сервер не обнаружен за 60 сек — открой превью вручную (⬡)',
}

const pt: I18n = {
  btnSend: 'Enviar',
  btnStop: '⏹ Parar',
  btnPreview: '⬡ Preview',
  btnClear: '✕ Limpar',
  btnAdd: '＋ Add',
  btnCommit: '✓ Commit',
  btnPush: '⬆ Push',
  modelAuto: '⚡ Auto',
  branchNew: '＋ Nova branch…',
  branchPlaceholder: 'nome da branch',
  emptyTitle: 'AIR pronto',
  emptyHint: 'Enter — enviar · Shift+Enter — nova linha',
  placeholder: 'Escreva uma mensagem…',
  placeholderStreaming: 'Gerando… pressione Parar para editar',
  msgGitProgress: op => ({ add: '⏳ Executando `git add -A`…', commit: '⏳ Executando add + commit…', push: '⏳ Executando add + commit + push…' }[op]),
  msgGitAdded: '✓ Todas as alterações adicionadas (`git add -A`)',
  msgGitCommitted: msg => msg ? `✓ Commit: "${msg}"` : '✓ Commit realizado',
  msgGitPushed: msg => msg ? `✓ Commit "${msg}" e push realizado` : '✓ Push realizado',
  msgGitError: err => `⚠ Git: ${err}`,
  msgNpmStarted: cmd => `▶ Executando \`${cmd}\`…`,
  msgDevWaiting: ports => `🚀 \`npm run dev\` iniciado, aguardando servidor… (portas: ${ports})`,
  msgDevReady: url => `🚀 Servidor ativo → ${url} · abrindo preview`,
  msgDevTimeout: '⚠ Servidor não encontrado em 60s — abra o preview manualmente (⬡)',
}

export function getStrings(locale: string): I18n {
  const l = locale.toLowerCase()
  if (l.startsWith('ru')) { return ru }
  if (l.startsWith('pt')) { return pt }
  return en
}
