let relatorioData = null;
let squadAtual = 'Onboarding';
let pagina = 1;
let pageSize = 25;
// Prioridade primeiro por padrão: crítico (menos dias) no topo, sem precisar clicar em nada.
let sortField = 'diasRestantes';
let sortDir = 'asc';

const CRITICO_DIAS = 4;
const ATENCAO_DIAS = 7;
const SAUDAVEL_DIAS = 10;
const TIMEZONE = 'America/Sao_Paulo';

function escapeHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatNumero(n) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('pt-BR');
}

function showToast(msg, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${escapeHtml(msg)}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 350); }, 3500);
}

/* =====================
   CARREGAR DADOS
===================== */

async function carregarRelatorio() {
  const body = document.getElementById('gridBody');
  body.innerHTML = '<tr><td colspan="8"><div class="empty-state">Carregando relatório...</div></td></tr>';
  try {
    const res = await fetch('/api/relatorio-listas');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    relatorioData = await res.json();
    pagina = 1;
    const atualizadoEm = new Date(relatorioData.geradoEm).toLocaleString('pt-BR', { timeZone: TIMEZONE });
    document.getElementById('headerUpdated').textContent = `Atualizado em ${atualizadoEm} (Brasília)`;
    render();
  } catch (e) {
    body.innerHTML = '<tr><td colspan="8"><div class="empty-state" style="color:var(--red)">Erro ao carregar relatório</div></td></tr>';
  }
}

function selecionarSquad(squad) {
  squadAtual = squad;
  pagina = 1;
  sortField = 'diasRestantes';
  sortDir = 'asc';
  document.querySelectorAll('.squad-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.squad === squad);
  });
  document.getElementById('filtroCampanha').value = '';
  document.getElementById('filtroStatus').value = 'todos';
  document.getElementById('squadView').style.display = squad === 'Report' ? 'none' : '';
  document.getElementById('reportView').style.display = squad === 'Report' ? '' : 'none';
  render();
}

function ordenarPor(campo) {
  if (sortField === campo) {
    sortDir = sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    sortField = campo;
    sortDir = 'asc';
  }
  pagina = 1;
  render();
}

function aplicarOrdenacao(linhas) {
  if (!sortField) return linhas;
  const dir = sortDir === 'asc' ? 1 : -1;
  return [...linhas].sort((a, b) => {
    const va = a[sortField];
    const vb = b[sortField];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === 'string') return va.localeCompare(vb, 'pt-BR') * dir;
    return (va - vb) * dir;
  });
}

function atualizarSetasOrdenacao() {
  document.querySelectorAll('.sort-arrow').forEach(el => {
    el.textContent = '';
    el.classList.remove('active');
  });
  if (!sortField) return;
  const el = document.getElementById('arrow-' + sortField);
  if (el) {
    el.textContent = sortDir === 'asc' ? '▲' : '▼';
    el.classList.add('active');
  }
}

function onFiltroChange() {
  pagina = 1;
  render();
}

function onPageSizeChange() {
  pageSize = parseInt(document.getElementById('pageSize').value, 10);
  pagina = 1;
  render();
}

/* =====================
   RENDER
===================== */

function classificarLinha(l) {
  if (l.status === 'erro') return 'erro';
  if (l.diasRestantes == null) return 'nada';
  if (l.diasRestantes < CRITICO_DIAS) return 'critico';
  if (l.diasRestantes < ATENCAO_DIAS) return 'atencao';
  if (l.diasRestantes < SAUDAVEL_DIAS) return 'saudavel';
  return 'nada';
}

function render() {
  if (!relatorioData) return;

  if (squadAtual === 'Report') {
    renderReportSummary();
    return;
  }

  const squadInfo = relatorioData.squads[squadAtual];
  const body = document.getElementById('gridBody');

  if (!squadInfo) {
    body.innerHTML = '<tr><td colspan="8"><div class="empty-state">Sem dados para este squad</div></td></tr>';
    renderKpis(null);
    renderFooter(0, 0, 0);
    return;
  }

  renderKpis(squadInfo);

  const texto = document.getElementById('filtroCampanha').value.toLowerCase();
  const statusFiltro = document.getElementById('filtroStatus').value;

  const linhasFiltradas = squadInfo.linhas.filter(l => {
    const bateTexto = !texto ||
      (l.campanha || '').toLowerCase().includes(texto) ||
      (l.contaEmail || '').toLowerCase().includes(texto) ||
      (l.clienteConta || '').toLowerCase().includes(texto) ||
      (l.campaignId || '').toLowerCase().includes(texto);
    if (!bateTexto) return false;
    if (statusFiltro === 'todos') return true;
    return classificarLinha(l) === statusFiltro;
  });

  const linhas = aplicarOrdenacao(linhasFiltradas);

  const maxAtivos = Math.max(1, ...squadInfo.linhas.map(l => l.ativosRestantes || 0));

  const totalPaginas = Math.max(1, Math.ceil(linhas.length / pageSize));
  if (pagina > totalPaginas) pagina = totalPaginas;
  const inicio = (pagina - 1) * pageSize;
  const paginaLinhas = linhas.slice(inicio, inicio + pageSize);

  if (!paginaLinhas.length) {
    body.innerHTML = '<tr><td colspan="8"><div class="empty-state">Nenhuma campanha encontrada</div></td></tr>';
  } else {
    body.innerHTML = paginaLinhas.map(l => renderLinha(l, maxAtivos)).join('');
  }

  renderFooter(linhas.length, inicio, inicio + paginaLinhas.length);
  renderPaginacao(totalPaginas);
  atualizarSetasOrdenacao();
}

function renderKpis(squadInfo) {
  if (!squadInfo) {
    document.getElementById('kpiDisparos').textContent = '—';
    document.getElementById('kpiCriticas').textContent = '—';
    document.getElementById('kpiAtivos').textContent = '—';
    document.getElementById('kpiCardCriticas').classList.remove('tem-criticas');
    return;
  }
  let totalDisparos = 0;
  let totalAtivos = 0;
  let criticas = 0;
  for (const l of squadInfo.linhas) {
    if (l.status === 'erro') continue;
    totalDisparos += l.disparos || 0;
    totalAtivos += l.ativosRestantes || 0;
    if (l.diasRestantes != null && l.diasRestantes < CRITICO_DIAS) criticas++;
  }
  document.getElementById('kpiDisparos').textContent = formatNumero(totalDisparos);
  document.getElementById('kpiCriticas').textContent = formatNumero(criticas);
  document.getElementById('kpiAtivos').textContent = formatNumero(totalAtivos);
  document.getElementById('kpiCardCriticas').classList.toggle('tem-criticas', criticas > 0);
}

function renderLinha(l, maxAtivos) {
  const classe = classificarLinha(l);
  const pills = {
    erro: '<span class="status-pill erro">⚠️ Erro</span>',
    critico: '<span class="status-pill critico">🔴 Crítico</span>',
    atencao: '<span class="status-pill atencao">🟡 Atenção</span>',
    saudavel: '<span class="status-pill saudavel">🟢 Saudável</span>',
    nada: '',
  };
  const pill = pills[classe];

  const barPct = Math.min(100, Math.round(((l.ativosRestantes || 0) / maxAtivos) * 100));

  const emAlerta = classe === 'critico' || classe === 'atencao';
  const prazoClasse = emAlerta ? `prazo-chip ${classe}` : 'prazo-chip';
  const prazoIcon = emAlerta ? '⚠️ ' : '';

  const linhaClasse = classe === 'erro' ? 'row-erro' : classe === 'critico' ? 'row-critico' : classe === 'atencao' ? 'row-atencao' : '';

  return `
    <tr class="${linhaClasse}">
      <td>
        <div class="cell-campanha">${escapeHtml(l.campanha || '—')}</div>
        ${pill}
      </td>
      <td class="cell-editable" data-valor="${escapeHtml(l.contaEmail || '')}" onclick="iniciarEdicao(this, ${l.listaSquadId}, 'contaEmail')">${escapeHtml(l.contaEmail || '—')}</td>
      <td>${escapeHtml(l.clienteConta || '—')}</td>
      <td class="num cell-mono cell-editable" data-valor="${l.disparos ?? ''}" onclick="iniciarEdicao(this, ${l.listaSquadId}, 'disparos')">${formatNumero(l.disparos)}</td>
      <td class="num">
        <div class="ativos-value">${formatNumero(l.ativosRestantes)}</div>
        <div class="ativos-bar-track"><div class="ativos-bar-fill" style="width:${barPct}%"></div></div>
      </td>
      <td class="num">
        <span class="${prazoClasse}">${prazoIcon}${escapeHtml(l.dataPrevista || '—')}</span>
      </td>
      <td>${renderSquadSelect(l)}</td>
      <td><button class="btn-excluir" title="Excluir lista" onclick="excluirLista(${l.listaSquadId}, this)">🗑</button></td>
    </tr>
  `;
}

const SQUADS_SELECIONAVEIS = ['Onboarding', 'SDR REMOTO', 'Geral'];

function renderSquadSelect(l) {
  const opcoes = SQUADS_SELECIONAVEIS.map(sq =>
    `<option value="${escapeHtml(sq)}" ${sq === squadAtual ? 'selected' : ''}>${escapeHtml(sq)}</option>`
  ).join('');
  return `<select class="select-input" onchange="mudarSquad(this, ${l.listaSquadId})">${opcoes}</select>`;
}

async function mudarSquad(select, listaSquadId) {
  const novoSquad = select.value;
  if (novoSquad === squadAtual) return;
  select.disabled = true;

  try {
    const res = await fetch(`/api/listas-squad/${listaSquadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ squad: novoSquad }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao salvar');

    showToast(`Movido para ${novoSquad}`, 'success');
    await carregarRelatorio();
  } catch (e) {
    showToast(e.message || 'Erro ao mudar squad', 'error');
    select.disabled = false;
    select.value = squadAtual;
  }
}

async function excluirLista(listaSquadId, btn) {
  if (!confirm('Excluir essa lista do squad? Essa ação não pode ser desfeita.')) return;
  btn.disabled = true;

  try {
    const res = await fetch(`/api/listas-squad/${listaSquadId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao excluir');

    showToast('Lista excluída', 'success');
    await carregarRelatorio();
  } catch (e) {
    showToast(e.message || 'Erro ao excluir lista', 'error');
    btn.disabled = false;
  }
}

function renderReportSummary() {
  const squads = ['Onboarding', 'SDR REMOTO', 'Geral'];
  const nomes = { 'Onboarding': 'Onboarding', 'SDR REMOTO': 'SDR Remoto', 'Geral': 'Geral' };
  const grid = document.getElementById('reportGrid');

  grid.innerHTML = squads.map(sq => {
    const info = relatorioData.squads[sq];
    if (!info) return '';

    let criticas = 0, atencao = 0, saudaveis = 0, semAlerta = 0, totalDisparos = 0;
    for (const l of info.linhas) {
      if (l.status === 'erro') continue;
      totalDisparos += l.disparos || 0;
      const classe = classificarLinha(l);
      if (classe === 'critico') criticas++;
      else if (classe === 'atencao') atencao++;
      else if (classe === 'saudavel') saudaveis++;
      else semAlerta++;
    }

    return `
      <div class="report-squad-card">
        <div class="report-squad-title">${escapeHtml(nomes[sq])}</div>
        <div class="report-stats">
          <div class="report-stat-tile critico ${criticas > 0 ? 'tem-valor' : ''}">
            <div class="report-stat-value">${formatNumero(criticas)}</div>
            <div class="report-stat-label">🔴 Crítico (&lt; 4 dias)</div>
          </div>
          <div class="report-stat-tile atencao">
            <div class="report-stat-value">${formatNumero(atencao)}</div>
            <div class="report-stat-label">🟡 Atenção (4–7 dias)</div>
          </div>
          <div class="report-stat-tile saudavel">
            <div class="report-stat-value">${formatNumero(saudaveis)}</div>
            <div class="report-stat-label">🟢 Saudável (7–10 dias)</div>
          </div>
          <div class="report-stat-tile neutro">
            <div class="report-stat-value">${formatNumero(semAlerta)}</div>
            <div class="report-stat-label">Sem alerta (&gt; 10 dias)</div>
          </div>
          <div class="report-stat-tile neutro">
            <div class="report-stat-value">${formatNumero(totalDisparos)}</div>
            <div class="report-stat-label">Disparos</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderFooter(total, inicio, fim) {
  const info = document.getElementById('gridFooterInfo');
  if (total === 0) {
    info.textContent = 'Nenhum item';
  } else {
    info.textContent = `Exibindo ${inicio + 1}-${fim} de ${total} itens`;
  }
}

function renderPaginacao(totalPaginas) {
  const el = document.getElementById('pagination');
  let html = `<button class="page-btn" ${pagina <= 1 ? 'disabled' : ''} onclick="irParaPagina(${pagina - 1})">‹</button>`;

  const janela = 5;
  let inicio = Math.max(1, pagina - Math.floor(janela / 2));
  let fim = Math.min(totalPaginas, inicio + janela - 1);
  inicio = Math.max(1, fim - janela + 1);

  for (let p = inicio; p <= fim; p++) {
    html += `<button class="page-btn ${p === pagina ? 'active' : ''}" onclick="irParaPagina(${p})">${p}</button>`;
  }

  html += `<button class="page-btn" ${pagina >= totalPaginas ? 'disabled' : ''} onclick="irParaPagina(${pagina + 1})">›</button>`;
  el.innerHTML = html;
}

function irParaPagina(p) {
  pagina = p;
  render();
}

/* =====================
   EDIÇÃO INLINE (conta / disparos)
===================== */

function iniciarEdicao(td, listaSquadId, campo) {
  if (td.querySelector('input')) return;

  const valorAtual = td.dataset.valor || '';
  const input = document.createElement('input');
  input.type = campo === 'disparos' ? 'number' : 'text';
  input.className = 'edit-input';
  input.value = valorAtual;
  td.innerHTML = '';
  td.appendChild(input);
  input.focus();
  input.select();

  let resolvido = false;

  const cancelar = () => {
    if (resolvido) return;
    resolvido = true;
    render();
  };

  const salvar = async () => {
    if (resolvido) return;
    const novo = input.value.trim();
    if (!novo || novo === valorAtual) {
      resolvido = true;
      render();
      return;
    }
    resolvido = true;
    input.disabled = true;

    try {
      const body = campo === 'disparos' ? { disparos: Number(novo) } : { contaEmail: novo };
      const res = await fetch(`/api/listas-squad/${listaSquadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar');

      showToast('Atualizado', 'success');
      await carregarRelatorio();
    } catch (e) {
      showToast(e.message || 'Erro ao salvar', 'error');
      render();
    }
  };

  input.addEventListener('blur', salvar);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelar(); }
  });
}

/* =====================
   INIT
===================== */
carregarRelatorio();
