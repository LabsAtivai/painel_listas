let contaSelecionada = null;
let campanhaSelecionada = null;
let campanhasCache = [];
let adicionados = [];
let buscaContaTimer = null;

function escapeHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
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
   PASSO 1 — CONTA SNOVIO
===================== */

function onBuscaContaChange() {
  clearTimeout(buscaContaTimer);
  const texto = document.getElementById('buscaConta').value.trim();
  const wrap = document.getElementById('resultadoContas');

  if (!texto) {
    wrap.innerHTML = '';
    return;
  }

  buscaContaTimer = setTimeout(async () => {
    try {
      const res = await fetch('/api/snovio/contas?busca=' + encodeURIComponent(texto));
      const contas = await res.json();
      renderResultadoContas(contas);
    } catch (e) {
      wrap.innerHTML = '<div class="result-empty">Erro ao buscar contas</div>';
    }
  }, 300);
}

function renderResultadoContas(contas) {
  const wrap = document.getElementById('resultadoContas');
  if (!contas.length) {
    wrap.innerHTML = '<div class="result-empty">Nenhuma conta ativa encontrada com credencial cadastrada</div>';
    return;
  }
  wrap.innerHTML = contas.map(c => `
    <div class="result-item" onclick='selecionarConta(${JSON.stringify(c).replace(/'/g, "&apos;")})'>
      <span class="principal">${escapeHtml(c.contaSnovio)}</span>
      <span class="secundario">${escapeHtml(c.email)}</span>
    </div>
  `).join('');
}

async function selecionarConta(conta) {
  contaSelecionada = conta;
  document.getElementById('contaBuscaWrap').style.display = 'none';
  document.getElementById('contaSelecionadaWrap').style.display = 'block';
  document.getElementById('contaSelecionadaEmail').textContent = conta.contaSnovio;
  document.getElementById('contaSelecionadaConta').textContent = conta.email;

  document.getElementById('stepCampanha').classList.remove('disabled');
  document.getElementById('resultadoCampanhas').innerHTML = '<div class="result-empty">Carregando campanhas...</div>';

  try {
    const res = await fetch('/api/snovio/campanhas?contaId=' + encodeURIComponent(conta.id));
    campanhasCache = await res.json();
    renderResultadoCampanhas(campanhasCache);
  } catch (e) {
    document.getElementById('resultadoCampanhas').innerHTML = '<div class="result-empty">Erro ao carregar campanhas</div>';
  }
}

function trocarConta() {
  contaSelecionada = null;
  campanhaSelecionada = null;
  campanhasCache = [];
  document.getElementById('buscaConta').value = '';
  document.getElementById('resultadoContas').innerHTML = '';
  document.getElementById('contaBuscaWrap').style.display = 'block';
  document.getElementById('contaSelecionadaWrap').style.display = 'none';
  document.getElementById('stepCampanha').classList.add('disabled');
  document.getElementById('stepDetalhes').classList.add('disabled');
  trocarCampanha();
}

/* =====================
   PASSO 2 — CAMPANHA
===================== */

function onBuscaCampanhaChange() {
  const texto = document.getElementById('buscaCampanha').value.toLowerCase();
  const filtradas = campanhasCache.filter(c => c.nome.toLowerCase().includes(texto));
  renderResultadoCampanhas(filtradas);
}

function renderResultadoCampanhas(campanhas) {
  const wrap = document.getElementById('resultadoCampanhas');
  if (!campanhas.length) {
    wrap.innerHTML = '<div class="result-empty">Nenhuma campanha encontrada pra essa conta</div>';
    return;
  }
  wrap.innerHTML = campanhas.map(c => `
    <div class="result-item" onclick='selecionarCampanha(${JSON.stringify(c).replace(/'/g, "&apos;")})'>
      <span class="principal">${escapeHtml(c.nome)}</span>
      <span class="secundario">${escapeHtml(c.statusSnovio || '—')}</span>
    </div>
  `).join('');
}

function selecionarCampanha(campanha) {
  campanhaSelecionada = campanha;
  document.getElementById('campanhaBuscaWrap').style.display = 'none';
  document.getElementById('campanhaSelecionadaWrap').style.display = 'block';
  document.getElementById('campanhaSelecionadaNome').textContent = campanha.nome;
  document.getElementById('campanhaSelecionadaStatus').textContent = campanha.statusSnovio || '—';
  document.getElementById('stepDetalhes').classList.remove('disabled');
}

function trocarCampanha() {
  campanhaSelecionada = null;
  document.getElementById('buscaCampanha').value = '';
  renderResultadoCampanhas(campanhasCache);
  document.getElementById('campanhaBuscaWrap').style.display = 'block';
  document.getElementById('campanhaSelecionadaWrap').style.display = 'none';
  document.getElementById('stepDetalhes').classList.add('disabled');
}

/* =====================
   PASSO 3 — SALVAR
===================== */

async function salvar() {
  const squad = document.getElementById('squad').value;
  const disparos = document.getElementById('disparos').value;
  const contaEmail = document.getElementById('contaEmail').value.trim();

  if (!disparos || Number(disparos) <= 0) { showToast('Informe os disparos', 'error'); return; }
  if (!contaEmail) { showToast('Informe o e-mail da campanha', 'error'); return; }

  const btn = document.getElementById('btnSalvar');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    const res = await fetch('/api/listas-squad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campanhaId: campanhaSelecionada.id,
        squad,
        contaEmail,
        disparos,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Erro ao adicionar', 'error');
      return;
    }

    adicionados.unshift({ campanha: campanhaSelecionada.nome, squad, disparos, contaEmail });
    renderAdicionados();
    showToast('Adicionado ao squad ' + squad, 'success');

    trocarCampanha();
    document.getElementById('disparos').value = '';
    document.getElementById('contaEmail').value = '';
  } catch (e) {
    showToast('Erro ao conectar ao servidor', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Adicionar ao squad';
  }
}

function renderAdicionados() {
  const card = document.getElementById('adicionadosCard');
  const lista = document.getElementById('listaAdicionados');
  card.style.display = 'block';
  lista.innerHTML = adicionados.map(a => `
    <div class="adicionado-item">
      <span class="campanha">${escapeHtml(a.campanha)}</span>
      <span class="meta">${escapeHtml(a.squad)} · ${escapeHtml(String(a.disparos))} disparos · ${escapeHtml(a.contaEmail)}</span>
    </div>
  `).join('');
}
