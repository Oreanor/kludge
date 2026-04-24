# Kludge Code

**Assistente de IA integrado ao VS Code — chat, edição de código, preview, git e automação em um único painel lateral.**

O Kludge Code conecta-se aos provedores de IA que você já usa (ou executa localmente) e incorpora uma interface de chat completa diretamente no VS Code. Sem abas de navegador, sem copiar e colar — apenas uma barra lateral onde você conversa com o seu código.

[English](README.md) · [Русский](README.ru.md)

---

## Funcionalidades

### Múltiplos provedores de IA — suas chaves, sua escolha

Conecte qualquer combinação de 8 provedores simultaneamente. O Kludge seleciona automaticamente o melhor modelo disponível, ou você escolhe pelo dropdown.

| Provedor | Modelos |
|---|---|
| Google Gemini | Gemini 2.0 Flash, Gemini 1.5 Pro/Flash |
| Anthropic | Claude 3.5 Sonnet, Claude 3 Haiku |
| OpenAI | GPT-4o, GPT-4o Mini |
| Groq | Llama 3, Mixtral (inferência ultra-rápida) |
| OpenRouter | Qualquer modelo via API unificada |
| DeepSeek | DeepSeek Chat, DeepSeek Coder |
| Mistral | Mistral Large, Codestral |
| Ollama | Qualquer modelo local na sua máquina |

As chaves de API são armazenadas no `SecretStorage` criptografado do VS Code — nunca em texto simples.

---

### Chat com contexto do workspace

Cada mensagem é enriquecida com contexto automaticamente:

- **Arquivo ativo** — o arquivo que você está editando está sempre no contexto
- **Lista de arquivos do projeto** — a IA sabe quais arquivos existem no projeto
- **Seletor de escopo** — limite o contexto a um arquivo específico, pasta ou projeto inteiro
- **Leitura de arquivos em dois passos** — se a IA precisar ver o conteúdo de um arquivo, ela o solicita e recebe uma resposta de segunda passagem com o código real, evitando desperdício de tokens em arquivos irrelevantes

---

### Múltiplas sessões de chat

Trabalhe em várias tarefas em paralelo sem perder o histórico. Cada sessão é uma aba no topo do painel — crie, alterne e feche de forma independente. Uma sessão pode estar em streaming enquanto você lê outra. Um indicador marca qualquer sessão aguardando resposta.

---

### Snapshot e restauração

Antes de cada mensagem enviada, o Kludge salva silenciosamente um snapshot de todos os arquivos abertos do workspace. Se a resposta da IA foi na direção errada, clique no botão **↩** ao lado de qualquer mensagem passada para restaurar os arquivos exatamente ao estado anterior àquele pedido — sem git, sem stash, sem trocar de branch.

Até 15 snapshots são mantidos no globalState do VS Code.

---

### Prompts rápidos

Ações com um clique para tarefas comuns. Prompts embutidos incluem refatorar, explicar, escrever testes e mais. Crie os seus próprios:

- Escolha um **prompt** no dropdown
- Escolha um **escopo** (arquivo ativo / pasta / projeto inteiro)
- Clique em **＋** para executar imediatamente, ou alterne para o modo **Tarefa** para agendar

Prompts personalizados são salvos nas configurações do VS Code (`kludge.customPrompts`) e sincronizados via Settings Sync.

---

### Agendador de tarefas

Precisa que a IA execute uma tarefa em horário específico? Agende qualquer prompt pelo calendário integrado:

- Escolha data e hora com o seletor de data/hora
- O calendário exibe tarefas pendentes como **pontos azuis** e concluídas como cinzas
- Clique em qualquer dia para ver suas tarefas com horários e prévia do texto
- Tarefas sobrevivem a reinicializações do VS Code — são restauradas e reagendadas na ativação
- Cancele qualquer tarefa pendente com um clique

---

### Painel git

Uma barra de ferramentas git compacta fica na área de entrada:

| Botão | Ação |
|---|---|
| Seletor de branch | Alterne branches ou crie uma nova inline |
| Commit | A IA gera a mensagem de commit automaticamente |
| Push | Commit + push em um clique |
| ↩prev | `git reset --hard HEAD~1` |
| ↩remote | `git fetch && git reset --hard origin/<branch>` |
| Init | Execute `git init` se o workspace ainda não for um repositório |

A IA também pode acionar operações git de forma autônoma. Quando você pede para "commitar isso" ou "enviar as mudanças", ela incorpora tags `<vscode-cmd>` ocultas na resposta que são executadas automaticamente e ocultadas do chat.

---

### Scripts npm

Execute qualquer script do `package.json` direto do painel. A lista de scripts é detectada automaticamente do seu workspace. A saída vai para o terminal do VS Code.

---

### Preview ao vivo com seletor de elementos

Abra seu servidor de desenvolvimento em execução (Vite, Next.js, React, Angular, Vue) em um painel lateral sem sair do VS Code:

- **Detecção automática** de portas comuns (5173, 3000, 4200, 8080 …) — se várias estiverem abertas, você escolhe da lista
- Um proxy transparente injeta um script bridge em cada carregamento de página
- **Seletor de elementos** — clique em qualquer elemento no preview e seu seletor, tag, dimensões e estilos computados são capturados como um chip no campo de entrada do chat — ideal para edições de estilo precisas
- **Correção automática de erros de runtime** — quando um `console.error` dispara no preview, o Kludge envia automaticamente o erro e o stack trace para a IA e transmite uma sugestão de correção
- **Hot-reload** ao salvar arquivos

---

### Integração com Telegram

Controle o assistente pelo celular. Conecte um token de bot do Telegram e um chat ID, e uma aba dedicada **Telegram** aparece na barra lateral:

- Mensagens enviadas pelo Telegram aparecem na aba em tempo real
- A IA responde e a resposta é enviada de volta para o Telegram automaticamente
- O token é armazenado no armazenamento secreto criptografado do VS Code; exibido como `••••••••••••`
- O botão de conectar permanece desativado até que você realmente altere a configuração

---

### Renderização Markdown

As respostas da IA são renderizadas como markdown formatado — blocos de código cercados, listas, negrito, citações, código inline. Os blocos de código são **recolhíveis**: trechos longos ficam recolhidos por padrão e se expandem com um clique, mantendo o chat legível mesmo com diffs grandes.

---

### Painel de gerenciamento de provedores

Adicione, remova, ative ou desative qualquer provedor sem sair do VS Code:

- Chaves exibidas mascaradas (`••••••••••••`)
- Ao remover uma chave, ela entra em **estado pendente** com botão de Restaurar — remoções acidentais são recuperáveis
- Desativar um provedor exclui seus modelos da seleção automática sem excluir a chave

---

## Primeiros passos

1. Instale a extensão
2. Abra o painel **Kludge Code** na Activity Bar (ícone de chama)
3. Expanda **Providers** e adicione pelo menos uma chave de API
4. Comece a conversar

Para usar o Ollama: instale localmente, inicie-o e adicione `http://localhost:11434` como URL do Ollama — sem chave de API necessária.

---

## Comandos

| Comando | Descrição |
|---|---|
| `Kludge Code: Open Preview` | Abrir o painel de preview ao lado do editor |
| `Kludge Code: Reload Preview` | Recarregar a página atual do preview |
| `Kludge Code: Pick Element` | Iniciar o seletor de elementos no preview |

---

## Configurações

| Configuração | Tipo | Descrição |
|---|---|---|
| `kludge.customPrompts` | array | Prompts rápidos personalizados. Cada item: `label` (nome na UI) e `text` (texto do prompt). |

```json
"kludge.customPrompts": [
  {
    "label": "Escrever testes",
    "text": "Escreva testes unitários abrangentes para o arquivo selecionado. Use o mesmo framework de testes já presente no projeto."
  },
  {
    "label": "Revisão de segurança",
    "text": "Revise este código em busca de vulnerabilidades. Verifique injeções, problemas de autenticação, desserialização insegura e outros riscos do OWASP top 10."
  }
]
```

---

## Requisitos

- VS Code 1.116+
- Pelo menos uma chave de API de provedor de IA, **ou** Ollama rodando localmente
