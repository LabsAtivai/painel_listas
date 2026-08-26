let relatorioData = null;
let squadAtual = 'Onboarding';
let pagina = 1;
let pageSize = 25;
let sortField = null;
let sortDir = 'asc';

const CRITICO_DIAS = 3;
const ATENCAO_DIAS = 10;
const TIMEZONE = 'America/Sao_Paulo';

function escapeHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function formatNumero(n) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('pt-BR');
}

/* =====================
   CARREGAR DADOS
===================== */

async function carregarRelatorio() {
  const body = document.getElementById('gridBody');
  body.innerHTML = '<tr><td colspan="6"><div class="empty-state">Carregando relatório...</div></td></tr>';
  try {
    const res = await fetch('/api/relatorio-listas');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    relatorioData = await res.json();
    pagina = 1;
    const atualizadoEm = new Date(relatorioData.geradoEm).toLocaleString('pt-BR', { timeZone: TIMEZONE });
    document.getElementById('headerUpdated').textContent = `Atualizado em ${atualizadoEm} (Brasília)`;
    render();
  } catch (e) {
    body.innerHTML = '<tr><td colspan="6"><div class="empty-state" style="color:var(--red)">Erro ao carregar relatório</div></td></tr>';
  }
}

function selecionarSquad(squad) {
  squadAtual = squad;
  pagina = 1;
  sortField = null;
  sortDir = 'asc';
  document.querySelectorAll('.squad-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.squad === squad);
  });
  document.getElementById('filtroCampanha').value = '';
  document.getElementById('filtroStatus').value = 'todos';
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
  if (l.diasRestantes == null) return 'ok';
  if (l.diasRestantes < CRITICO_DIAS) return 'critico';
  if (l.diasRestantes < ATENCAO_DIAS) return 'atencao';
  return 'ok';
}

function render() {
  if (!relatorioData) return;
  const squadInfo = relatorioData.squads[squadAtual];
  const body = document.getElementById('gridBody');

  if (!squadInfo) {
    body.innerHTML = '<tr><td colspan="6"><div class="empty-state">Sem dados para este squad</div></td></tr>';
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
    body.innerHTML = '<tr><td colspan="6"><div class="empty-state">Nenhuma campanha encontrada</div></td></tr>';
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
}

function renderLinha(l, maxAtivos) {
  const classe = classificarLinha(l);
  const pills = {
    erro: '<span class="status-pill erro">⚠️ Erro</span>',
    critico: '<span class="status-pill critico">🔴 Crítico</span>',
    atencao: '<span class="status-pill atencao">🟡 Atenção</span>',
    ok: '<span class="status-pill ok">🟢 Saudável</span>',
  };
  const pill = pills[classe];

  const barPct = Math.min(100, Math.round(((l.ativosRestantes || 0) / maxAtivos) * 100));

  const emAlerta = classe === 'critico' || classe === 'atencao';
  const prazoClasse = emAlerta ? `prazo-chip ${classe}` : 'prazo-chip';
  const prazoIcon = emAlerta ? '⚠️ ' : '';

  return `
    <tr class="${classe === 'erro' ? 'row-erro' : ''}">
      <td>
        <div class="cell-campanha">${escapeHtml(l.campanha || '—')}</div>
        ${pill}
      </td>
      <td>${escapeHtml(l.contaEmail || '—')}</td>
      <td>${escapeHtml(l.clienteConta || '—')}</td>
      <td class="num cell-mono">${formatNumero(l.disparos)}</td>
      <td class="num">
        <div class="ativos-value">${formatNumero(l.ativosRestantes)}</div>
        <div class="ativos-bar-track"><div class="ativos-bar-fill" style="width:${barPct}%"></div></div>
      </td>
      <td class="num">
        <span class="${prazoClasse}">${prazoIcon}${escapeHtml(l.dataPrevista || '—')}</span>
      </td>
    </tr>
  `;
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
   INIT
===================== */
carregarRelatorio();
