# Spec: Painel de Relatório de Listas

> **Revisão 5 (atual) — migrado de Google Sheets pra MySQL.** As seções abaixo com
> `(revisão 4)`/`(revisão 3)` descrevem a fase em que o app ainda lia/escrevia Google Sheets —
> ficam só como histórico de como cada decisão foi chegando até aqui. A fonte de dados real hoje é
> o MySQL de produção (`db/schema.sql`); ver §0.0 pra arquitetura atual.

## 0.0 Migração pra MySQL (revisão 5)

Decisão do usuário: sair do Google Sheets como fonte de dados operacional. Todo o fluxo de
campanha → squad → relatório passou a viver no MySQL de produção (`relatoriolistas` em
`207.244.249.157:3306`, credenciais em `.env`, nunca commitadas).

**Schema** (`db/schema.sql`, aplicado — rodar `node db/apply-schema.mjs` se precisar reaplicar):

| Tabela | Papel |
|---|---|
| `contas_snovio` | Espelho leve das contas ativas do sistema de credenciais (id, e-mails, status). **Sem segredo** — client_id/secret/senha continuam só no `credenciais` (snov-am-api). |
| `campanhas` | Cache das campanhas por conta (nome, status, `ativos_restantes`) — populada/atualizada a cada execução dos scripts. |
| `listas_squad` | Substitui as abas Onboarding/SDR REMOTO/Geral **e** a antiga fila "Adicionar" — uma campanha adicionada já nasce aqui direto, sem etapa de staging (o formulário usa dropdown de campanha real, não texto livre, então o risco que justificava a fila antes não existe mais). |

`dias_restantes` e `data_prevista` continuam calculados em JS na leitura (não ficam gravados),
mesma lógica de antes (`ativos_restantes / disparos`, dias úteis a partir de ontem).

**O que mudou em cada arquivo**:

- `services/db.js` — pool de conexão MySQL (`mysql2/promise`), lê `MYSQL_*` do `.env`.
- `services/snovioCache.js` — upsert de `contas_snovio`/`campanhas`, update de `ativos_restantes`.
- `services/listasSquadService.js` — busca de conta por e-mail (ao vivo, ver nota abaixo), campanhas por conta (cache), insert em `listas_squad` (usado pela tela nova).
- `services/credentialsApi.js` — ganhou `searchActiveAccounts(query)`: busca ao vivo no sistema de credenciais (`GET /api/accounts?q=`, barato, sem descriptografar) e só decripta a `conta_snovio` das poucas contas que já bateram no filtro. O passo 1 do formulário "Adicionar lista" usa isso em vez de `contas_snovio` — decisão do usuário: busca de conta não precisa de cache, é rápida na hora e fica sempre atualizada (conta nova aparece na hora, sem esperar rodar "Campanhas"). `contas_snovio` continua existindo só como cache/FK pra campanhas, populada pelos scripts de sync — não é mais consultada na busca do formulário.
- `services/relatorioListasReader.js` — reescrito do zero: lê `listas_squad` + `campanhas` + `contas_snovio` via JOIN em vez de `spreadsheets.values.batchGet`. Mesmo formato de resposta de antes (`{ squad, totalLinhas, linhasComErro, linhas[] }`), então o front-end (`public/script.js`, home) não precisou mudar.
- `scripts/relatoriocampanha1.mjs` — em vez de `append` na aba "campanhas" do Sheets, faz upsert em `contas_snovio`/`campanhas`.
- `scripts/relatorioListasv2.mjs` — em vez de ler a aba "campanhas" e escrever na aba "unfinished", lê `campanhas` do MySQL por conta e grava `ativos_restantes` de volta no MySQL.
- `scripts/geral.mjs` — perdeu a Etapa 0 (sincronizar Adicionar/Retirar) e a etapa de limpar as abas do Sheets — não fazem mais sentido, nada lê essas abas.
- `public/adicionar-lista.html`/`.js` (rota `/adicionar-lista`) — **substitui** a antiga `/fila-adicao`. Fluxo: digitar conta Snovio → confirma que existe em `contas_snovio` → dropdown de campanhas cacheadas daquela conta (sem chamar Snov.io na hora) → escolhe squad + digita disparos/e-mail → grava direto em `listas_squad`. Depois de salvar, mantém a conta selecionada e limpa só a campanha, pra adicionar várias campanhas da mesma conta em sequência.

**O que ficou pra trás, de propósito, sem migrar ainda:**

- `scripts/sincronizarListas.mjs` (botão "Sincronizar listas" em `/executar`) — continua existindo e funcional pro fluxo antigo de "Retirar" no Sheets, mas não roda mais automaticamente (tirado do `geral.mjs`). Não existe ainda um "retirar campanha do squad" no MySQL — hoje só dá pra fazer via `DELETE FROM listas_squad WHERE id = ...` direto no banco. Se precisar no dia a dia, é next step natural.
- `services/filaAdicaoReader.js` e `services/snovioLookup.js` (busca ao vivo de conta por nome de campanha) foram **deletados** — obsoletos, a tela nova já sabe o `campanha_id` de antemão (veio do dropdown), não precisa mais adivinhar em qual conta uma campanha está.
- Abas antigas do Google Sheets (`campanhas`, `unfinished`, squad tabs, `Adicionar`/`Retirar`) continuam existindo na planilha, só que **paradas** — nada escreve nelas mais. Se alguém do time ainda abre essa planilha direto (fora do painel), vai ver dado cada vez mais desatualizado. Vale avisar quem usa.

## 0.0.1 Incidente de deploy (pós-migração) e ajustes seguintes

Depois do primeiro deploy em produção, `/api/relatorio-listas` voltou 500. Causa raiz (achada via
`docker logs painel-relatorios`): o usuário `root` do MySQL tinha **dois grants** —
`root@'%'` (senha certa, a do `.env`) e `root@'172.18.0.1'` (o IP que o container usa por causa do
NAT quando acessa o próprio IP público do host — hairpin) com senha diferente/velha. MySQL casa pelo
host mais específico primeiro, então a conexão do container caía sempre no grant errado. Resolvido
com `DROP USER 'root'@'172.18.0.1'; FLUSH PRIVILEGES;` — sobrou só `root@'%'` e `root@'localhost'`.
Rede Docker (`ativaai`) e as env vars (`MYSQL_*`/`CREDENTIALS_*`) já estavam corretas, não era isso.

Dois ajustes pedidos pelo usuário depois que o dado real começou a aparecer:

- **Campanhas do dropdown (passo 2 de `/adicionar-lista`) filtram por `status_snovio = 'Active'`**
  (`services/listasSquadService.js` → `listarCampanhasPorConta`). Campanhas arquivadas/pausadas/
  completadas no Snov.io não aparecem mais pra escolher — só as que ainda estão rodando.
- **"Conta" e "Disparos" viraram editáveis direto na grid da home** — clique na célula (linha vira
  input, Enter salva/Esc cancela/blur salva), `PATCH /api/listas-squad/:id`
  (`services/listasSquadService.js` → `atualizarListaSquad`). Precisou expor `listaSquadId`
  (o `ls.id`, não o `campaignId`) na resposta de `getSquad()` — antes a grid não tinha nenhum
  identificador que apontasse pra linha específica de `listas_squad`, só pro `campanhas.id`
  compartilhado entre squads. Depois de salvar, recarrega o relatório inteiro (não só a célula) pra
  `dias_restantes`/`data_prevista` recalcularem certo quando `disparos` muda.

## 0. Arquitetura de rotas (revisão 4)

O app tem três páginas:

| Rota | Arquivo | Conteúdo |
|---|---|---|
| `GET /` | `public/index.html` + `public/script.js` | **Home = dados.** Painel redesenhado (KPIs + grid) só de leitura, squads Onboarding/SDR Remoto/Geral. |
| `GET /executar` | `public/executar.html` + `public/executar.js` | Seleção de clientes, botões de rodar scripts, logs em tempo real via socket.io, agendamento. |
| `GET /fila-adicao` | `public/fila-adicao.html` + `public/fila-adicao.js` | Fila de campanhas pendentes na aba "Adicionar" (staging antes de "Sincronizar listas"), só leitura, com busca ao vivo de conta Snovio por campanha. |

As três páginas linkam entre si no header. `campanhas` e `unfinished` (abas da planilha de
relatórios) seguem fora de escopo; `reports` também não é lido — os KPIs da home são calculados no
cliente a partir das próprias linhas de cada squad (ver §3), o que evita divergência entre o card de
KPI e os badges 🔴/🟡/🟢 mostrados na grid.

## 0.1 Fila de adição (`/fila-adicao`)

Lê (só leitura) a aba **"Adicionar"** da planilha de atualização (`PLANILHA_ATUALIZACAO`, id
`19xZbODwwgq8fLYW5v0JNKJSEOM0iA69wT_90_VW9tE0` — a mesma que `scripts/sincronizarListas.mjs`
processa e limpa quando roda "Sincronizar listas"). Endpoint `GET /api/fila-adicao`
(`services/filaAdicaoReader.js`).

**Bug encontrado nessa investigação:** `processAdicionar()` em `scripts/sincronizarListas.mjs` lê as
colunas na posição errada. O cabeçalho real da aba é `Cliente(=campanha) | Email | Disparos | squad |
Pausada | Cliente(nome bonito)`, mas o código lê `email` da coluna C (na verdade "Disparos"),
`disparos` da coluna D (na verdade "squad", então `parseInt("Geral")` sempre vira `0`) e `squad` da
coluna E (na verdade "Pausada", valor `"ativa"/"pausada"` — nunca bate com `mapSquadToTab()`, então a
linha cai em `unmapped` e nunca é sincronizada). Resultado prático: a aba "Adicionar" nunca esvazia
sozinha — tinha 214 linhas acumuladas quando isso foi descoberto. **Não corrigido ainda** (é o
caminho de escrita da planilha, mudança de comportamento de produção — fora do escopo desta tela,
que é só leitura). `services/filaAdicaoReader.js` já lê as colunas certas (posição real, não a que o
script de sincronização usa). Ver conversa/decisão do usuário sobre corrigir ou não o script de sync.

Coluna "Contas" na tela usa célula dupla igual à home (`cell-contas`/`conta-primary`/`conta-secondary`):
linha 1 = e-mail (coluna B), linha 2 = nome da conta/cliente (coluna F, ex. "Aksum 360").

A coluna "Conta Snovio" busca ao vivo: `POST /api/fila-adicao/buscar-conta { campanha }`
(`services/snovioLookup.js`) percorre as contas ativas do sistema de credenciais
(`services/credentialsApi.js` → `getActiveClients()`), pedindo token + `GET
/v1/get-user-campaigns` por conta, até achar uma campanha com esse nome (para assim que acha —
custo depende de em qual conta a campanha está). Botão por linha ("Buscar") ou em lote ("Buscar
todas as contas Snovio", sequencial, evita martelar a API de uma vez).

## 0.2 "Rodar selecionados" ligado ao sistema de credenciais

`POST /api/rodar` (botão "Rodar selecionados" em `/executar`) **era um stub** — só dava
`setTimeout` de 1.5s por cliente e fingia sucesso, não chamava nenhum script de verdade. Agora chama
de fato `relatoriocampanha1.mjs` e `relatorioListasv2.mjs`, só para os clientes marcados no modal.

Para isso os dois scripts passaram a aceitar uma lista opcional de clientes:
`export async function main(clientesSelecionados)` — se vier populada, usa ela; senão (chamada sem
argumento, como no cron e nos botões "Campanhas"/"Listas"/"Rodar geral" individuais) continua
buscando todos os clientes ativos via `getActiveClients()`, comportamento inalterado.

`server.js` remapeia o formato que `/api/clientes` devolve (`email/api1/api2/snovioMail/senha`,
usado pelo modal de seleção) para o formato que os scripts esperam
(`email/clientId/clientSecret/emailSnovio/senha`) antes de chamar.

Não roda `sincronizarListas` nem limpa `campanhas`/`unfinished` para o subconjunto selecionado —
essas duas etapas de "Rodar geral" são globais (limpar a planilha inteira apagaria dados de clientes
não selecionados). Mesma ressalva de duplicação que já existia nos botões "Campanhas"/"Listas"
individuais: como não há `clear` antes do `append`, rodar mais de uma vez para o mesmo cliente
acumula linhas repetidas nas abas `campanhas`/`unfinished` — comportamento pré-existente, não
introduzido por essa mudança.

## 1. Escopo dos dados

Só estas 3 abas são lidas pelo backend. Todas as demais (Squad 1-9, Key Accounts, SalesOPS,
Capacitação, Clientes, listas_invalidas, zero_email, disparosAnterior, log, reports, campanhas,
unfinished) ficam **fora de escopo**.

| Aba | Papel |
|---|---|
| `Onboarding` | Tabela detalhada de listas do squad Onboarding |
| `SDR REMOTO` | Tabela detalhada de listas do squad SDR Remoto |
| `Geral` | Tabela detalhada de listas do squad Geral |

## 2. Abas `Onboarding` / `SDR REMOTO` / `Geral` — detalhe por squad

As três são as abas "saudáveis" (0–2% de linhas com erro de fórmula, medido no arquivo real).

Layout de linha: 3 linhas de cabeçalho (título solto, resumo do squad, rótulos de coluna — nem
sempre preenchidos) e dados a partir da linha 4. Localizar a linha de cabeçalho procurando a primeira
linha (das 5 primeiras) com uma célula cujo texto comece com `"disparos"` (case-insensitive); dados
começam 2 linhas abaixo.

Mapeamento de coluna (posicional para A–D, por nome pro resto):

| Campo | Coluna | Observação |
|---|---|---|
| `campaignId` | A (posição 0) | sempre, mesmo sem cabeçalho |
| `campanha` | B (posição 1) | nome da campanha |
| `contaEmail` | C (posição 2) | e-mail do operador |
| `clienteConta` | D (posição 3) | conta Snov.io do cliente |
| `disparos` | cabeçalho normalizado `"disparos"` | |
| `ativosRestantes` | cabeçalho em `{"totais ativos","ativos totais","ativos","total ativo"}` | |
| `diasRestantes` | cabeçalho normalizado `"dias restantes"` | |
| `dataPrevista` | cabeçalho começando com `"ativos restantes ate"` | data prevista de esgotamento |

Erros de fórmula (`#REF!`, `#N/A`, `#DIV/0!`, `#VALUE!`, `#NAME?`, `#NULL!`, `#NUM!`, `#ERROR!`) em
qualquer campo canônico marcam a linha como `status: "erro"` — a linha continua na resposta (não é
descartada), a UI decide como destacar. Linha sem `campaignId` e sem `campanha` é descartada (linha
vazia de formatação).

**Pegadinha real encontrada:** com `valueRenderOption: UNFORMATTED_VALUE` a API do Sheets não
devolve só o código do erro — em alguns casos vem com detalhe extra, ex.:
`"#N/A (Did not find value 'X' in MATCH evaluation.)"`. Comparação por igualdade exata
(`valor === "#N/A"`) não pega esse caso e a linha some do total de erro / vira `NaN` nos KPIs
somados no cliente. A detecção precisa ser por **prefixo** (`valor.startsWith("#N/A")` etc.), não por
igualdade.

```json
{
  "squad": "Geral",
  "totalLinhas": 148,
  "linhasComErro": 0,
  "linhas": [
    {
      "status": "ok",
      "campaignId": "3090670",
      "campanha": "Protego Brasil - Campanha Satisfação do cliente",
      "contaEmail": "_victor_@mktprotego.com.br",
      "clienteConta": "protego.ativa@gmail.com",
      "disparos": 60,
      "ativosRestantes": 0,
      "diasRestantes": 0,
      "dataPrevista": "2026-08-24"
    }
  ]
}
```

## 3. API

Único endpoint, uma chamada `spreadsheets.values.batchGet` com os 3 ranges de squad (evita estourar
quota; `reports`/`campanhas`/`unfinished` não são mais lidos):

`GET /api/relatorio-listas`

```json
{
  "geradoEm": "2026-08-25T19:00:00-03:00",
  "squads": {
    "Onboarding": { /* §2 */ },
    "SDR REMOTO": { /* §2 */ },
    "Geral": { /* §2 */ }
  }
}
```

## 4. UI — home (`/`)

Adapta a `Especificação de UI_UX - Redesign da Aba Geral.txt` (fornecida pelo usuário) para os dados
reais disponíveis e para o tema escuro já estabelecido no resto do app. Diferenças deliberadas em
relação ao documento original, e o motivo de cada uma:

| Pedido no doc original | O que foi feito aqui | Por quê |
|---|---|---|
| Fundo branco/cinza-claro (`#FFFFFF`/`#F8FAFC`) | Mantido o tema escuro do app | O documento mostra um mockup em modo claro só como exemplo; o princípio (fundo neutro, cor só em elementos pontuais) foi seguido, mas trocar o app inteiro pra claro quebraria consistência com `/executar`. |
| Coluna "Ativos e % Relação" com barra colorida | Barra sutil de "ativos restantes" escalada pelo maior valor do squad (sem %) | Os dados reais não têm um "tamanho total da lista" pra calcular uma porcentagem sem inventar número. A barra vira comparação relativa honesta em vez de uma % fabricada. |
| Filtro de "Selecionar Data" | Trocado por "Atualizado em `<timestamp>`" + botão Atualizar | A fonte é um snapshot ao vivo da planilha, não uma série histórica por dia — não existe outro "dia" pra selecionar. |
| Coluna de Ações (editar/pausar/exportar) | Omitida | Painel é somente leitura; não há endpoint de escrita/mutação em campanha implementado, então o menu ficaria só decorativo. |
| KPI "Contas Críticas" vindo de fonte separada | Calculado no cliente a partir das mesmas linhas da grid (`diasRestantes < CRITICO_DIAS`) | Garante que o número do card bate exatamente com a contagem de badges 🔴 visíveis na tabela — a aba `reports` (fonte original desse número) é manual e ficou defasada em relação às abas de squad. |

**Faixas de prazo** (`diasRestantes`, definidas pelo usuário — constantes `CRITICO_DIAS`/`ATENCAO_DIAS`/
`SAUDAVEL_DIAS` em `public/script.js`):

| Faixa | Cor | Pill | Chip de prazo |
|---|---|---|---|
| `< 4` dias | 🔴 vermelho | Crítico | ⚠️ vermelho |
| `4` a `< 7` dias | 🟡 amarelo | Atenção | ⚠️ amarelo |
| `7` a `< 10` dias | 🟢 verde | Saudável | neutro |
| `≥ 10` dias (ou sem dado) | nenhuma | sem pill | neutro |
| `status: "erro"` (fórmula quebrada na planilha) | 🟣 roxo | Erro | `—` (sem prazo confiável) |

Erro usa roxo (não amarelo) de propósito: amarelo já é o tom de "atenção" no prazo, então reaproveitar
pra erro de fórmula confundiria os dois conceitos (dado ruim vs. prazo apertado).

Estrutura implementada (`public/index.html` + `public/script.js`):

- Header: logo, "Atualizado em `<data/hora>` (Brasília)" — `geradoEm` vem em UTC do backend
  (`new Date().toISOString()`) e é formatado no cliente com `timeZone: 'America/Sao_Paulo'`
  (`Intl`/`toLocaleString`), então funciona igual não importa o fuso do navegador ou do servidor —,
  botão Atualizar, link `Rodar relatório →` para `/executar`.
- Cabeçalhos da grid (Campanha, Contas, Disparos, Ativos restantes, Prazo) são clicáveis: primeiro
  clique ordena ascendente, segundo clique no mesmo cabeçalho inverte pra descendente (seta ▲/▼ no
  cabeçalho ativo). Troca de squad reseta a ordenação. Nulo (ex.: `diasRestantes` de linha com erro)
  sempre vai pro fim da lista, nas duas direções.
- Busca por texto cobre `campanha`, `contaEmail`, `clienteConta` e `campaignId`.
- Abas de squad: Onboarding / SDR Remoto / Geral — trocar de aba reseta busca, filtro de status e
  paginação.
- Barra de filtros: busca texto (campanha/conta/cliente) + select de status (Todos / Crítico /
  Atenção / Saudável / Sem alerta / Com erro).
- 3 KPI cards por squad, calculados sobre **todas** as linhas do squad (não afetados pelos filtros
  da tabela): Total de disparos, Contas críticas (`diasRestantes < 4`, com borda vermelha), Total de
  ativos restantes.
- Grid: Campanha + pill de status (🔴 Crítico / 🟡 Atenção / 🟢 Saudável / sem pill quando "sem alerta"
  / 🟣 Erro) · Contas em célula dupla (e-mail operador em destaque, conta Snov.io do cliente em cinza) ·
  Disparos (mono, alinhado à direita) · Ativos restantes com barra sutil · Prazo (data + ⚠️ na cor da
  faixa quando crítico/atenção).
  Linha com `status:"erro"` fica com opacidade reduzida e pill de erro, mas não é removida.
  Ordenação segue a ordem que vem da planilha (não há colunas de ordenação implementadas).
- Paginação: seletor 10/25/50 por página, botões prev/next + números de página, texto
  "Exibindo X-Y de Z itens".
- Somente leitura — nenhuma ação de escrita a partir desta página.

## 5. UI — execução (`/executar`)

Página antiga completa (seleção de clientes, botões "Rodar selecionados"/"Rodar geral"/scripts
individuais, logs em tempo real via socket.io, card de agendamento diário às 19h). Link
`← Ver dados` no header volta pra home. Nenhuma mudança de comportamento em relação à versão anterior
além do link de navegação.

## 6. Casos de borda

- Nome de aba com espaço/acento irregular: usar exatamente como retornado por
  `spreadsheets.get` ao montar os ranges do `batchGet`.
- `valueRenderOption: UNFORMATTED_VALUE` + `dateTimeRenderOption: FORMATTED_STRING`: números vêm
  como number nativo do JS, datas como string já formatada — sem parse adicional no servidor. Ver a
  pegadinha de erro com texto extra no §2.
- Squad sem nenhuma linha (`headerIdx === -1`): endpoint devolve o squad com `linhas: []` em vez de
  quebrar a resposta inteira.
