const socket = io();

let clientes = [];
let clientesFiltrados = [];
let selecionados = new Set();
let logLines = [];
let processados = 0;
let erros = 0;
let logEmpty = true;

/* =====================
   SOCKET
===================== */

socket.on('connect', () => {
  document.getElementById('statusDot').classList.add('connected');
  document.getElementById('statusText').textContent = 'Conectado';
});

socket.on('disconnect', () => {
  document.getElementById('statusDot').classList.remove('connected');
  document.getElementById('statusText').textContent = 'Desconectado';
});

socket.on('log', (msg) => {
  appendLog(msg);
});

socket.on('progresso', (valor) => {
  setProgress(valor);
});

socket.on('status', (data) => {
  if (data.processados !== undefined) {
    processados = data.processados;
    document.getElementById('statProcessados').textContent = processados;
  }
  if (data.erros !== undefined) {
    erros = data.erros;
    document.getElementById('statErros').textContent = erros;
  }
  if (data.label) {
    document.getElementById('progressLabel').textContent = data.label;
  }
});

socket.on('script-done', (data) => {
  const btnId = data.btn;
  const btn = document.getElementById(btnId);
  if (btn) {
    btn.classList.remove('running');
    btn.classList.add('done');
    setTimeout(() => btn.classList.remove('done'), 3000);
  }
  showToast(data.msg || 'Concluído!', 'success');
  setProgress(100);
  setTimeout(() => setProgress(0), 4000);
});

socket.on('script-error', (data) => {
  const btn = data.btn && document.getElementById(data.btn);
  if (btn) {
    btn.classList.remove('running');
    btn.classList.add('error-state');
    setTimeout(() => btn.classList.remove('error-state'), 4000);
  }
  showToast(data.msg || 'Erro na execução', 'error');
});

/* =====================
   LOG
===================== */

function getLogClass(msg) {
  const lower = msg.toLowerCase();
  if (lower.includes('erro') || lower.includes('error') || lower.includes('fail')) return 'error';
  if (lower.includes('finalizado') || lower.includes('sucesso') || lower.includes('✔') || lower.includes('✅')) return 'success';
  if (lower.includes('aguardando') || lower.includes('warn') || lower.includes('⚠')) return 'warn';
  if (lower.includes('iniciando') || lower.includes('→') || lower.includes('rodando') || lower.includes('processando')) return 'info';
  if (lower.includes('━') || lower.includes('processo')) return 'system';
  return '';
}

function appendLog(msg) {
  const logsDiv = document.getElementById('logs');

  if (logEmpty) {
    logsDiv.innerHTML = '';
    logEmpty = false;
  }

  const now = new Date();
  const time = now.toTimeString().slice(0, 8);
  logLines.push({ time, msg });

  const line = document.createElement('div');
  line.className = 'log-line';
  line.innerHTML = `<span class="log-time">${time}</span><span class="log-msg ${getLogClass(msg)}">${escapeHtml(msg)}</span>`;
  logsDiv.appendChild(line);
  logsDiv.scrollTop = logsDiv.scrollHeight;
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function limparLogs() {
  document.getElementById('logs').innerHTML = '<div class="log-empty"><span style="font-size:22px;opacity:0.4">🖥</span><span>Logs limpos</span></div>';
  logLines = [];
  logEmpty = true;
  processados = 0;
  erros = 0;
  document.getElementById('statProcessados').textContent = '0';
  document.getElementById('statErros').textContent = '0';
}

function exportarLogs() {
  if (!logLines.length) { showToast('Nenhum log para exportar', 'info'); return; }
  const content = logLines.map(l => `[${l.time}] ${l.msg}`).join('\n');
  const blob = new Blob([content], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `logs_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.txt`;
  a.click();
  showToast('Logs exportados!', 'success');
}

/* =====================
   PROGRESS
===================== */

function setProgress(valor) {
  document.getElementById('barraProgresso').style.width = valor + '%';
  document.getElementById('progressPct').textContent = valor + '%';
  if (valor > 0 && valor < 100) {
    document.getElementById('progressLabel').textContent = 'Executando...';
  } else if (valor === 100) {
    document.getElementById('progressLabel').textContent = 'Concluído!';
  } else {
    document.getElementById('progressLabel').textContent = 'Aguardando execução...';
  }
}

/* =====================
   TOAST
===================== */

function showToast(msg, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warn: '⚠️' };
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${escapeHtml(msg)}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 350); }, 3500);
}

/* =====================
   CLIENTES
===================== */

async function carregarClientes() {
  try {
    const res = await fetch('/api/clientes');
    clientes = await res.json();
    clientesFiltrados = [...clientes];
    renderClientes(clientesFiltrados);
  } catch (e) {
    document.getElementById('listaClientes').innerHTML = '<div style="padding:40px;text-align:center;color:var(--red);font-size:13px">Erro ao carregar clientes</div>';
  }
}

function getInitials(email) {
  if (!email) return '?';
  const parts = email.split('@')[0].split(/[._-]/);
  return (parts[0]?.[0] || '') .toUpperCase() + (parts[1]?.[0] || parts[0]?.[1] || '').toUpperCase();
}

function renderClientes(lista) {
  const tbody = document.getElementById('listaClientes');
  document.getElementById('countFiltrados').textContent = lista.length + ' cliente' + (lista.length !== 1 ? 's' : '');

  if (!lista.length) {
    tbody.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text3);font-size:13px">Nenhum cliente encontrado</div>';
    return;
  }

  tbody.innerHTML = lista.map(c => `
    <div class="client-row" onclick="toggleCliente('${c.email}', this)">
      <input type="checkbox" class="clienteCheck" data-email="${c.email}" ${selecionados.has(c.email) ? 'checked' : ''} onclick="event.stopPropagation();toggleCliente('${c.email}', this.closest('.client-row'))">
      <div class="client-avatar">${getInitials(c.email)}</div>
      <div class="client-info">
        <div class="client-email">${c.email || '—'}</div>
        <div class="client-snov">${c.snovioMail || '—'}</div>
      </div>
    </div>
  `).join('');

  atualizarContador();
}

function toggleCliente(email, row) {
  if (selecionados.has(email)) {
    selecionados.delete(email);
  } else {
    selecionados.add(email);
  }
  const cb = row.querySelector('input[type=checkbox]');
  if (cb) cb.checked = selecionados.has(email);
  atualizarContador();
}

function filtrarClientes() {
  const texto = document.getElementById('filtroClientes').value.toLowerCase();
  clientesFiltrados = clientes.filter(c =>
    (c.email && c.email.toLowerCase().includes(texto)) ||
    (c.snovioMail && c.snovioMail.toLowerCase().includes(texto))
  );
  renderClientes(clientesFiltrados);
}

let todosSelected = false;
function toggleTodos() {
  todosSelected = !todosSelected;
  document.querySelectorAll('.clienteCheck').forEach(c => {
    c.checked = todosSelected;
    if (todosSelected) selecionados.add(c.dataset.email);
    else selecionados.delete(c.dataset.email);
  });
  document.querySelector('.select-all-btn').textContent = todosSelected ? 'Desmarcar todos' : 'Selecionar todos';
  atualizarContador();
}

function atualizarContador() {
  const count = selecionados.size;
  document.getElementById('contador').textContent = count;
  document.getElementById('badgeSelecionados').textContent = count;
  document.getElementById('statSelecionados').textContent = count;
}

/* =====================
   MODAL
===================== */

function abrirModal() {
  document.getElementById('modalClientes').classList.add('open');
  if (!clientes.length) carregarClientes();
}

function fecharModal() {
  document.getElementById('modalClientes').classList.remove('open');
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') fecharModal();
});

document.getElementById('modalClientes').addEventListener('click', function(e) {
  if (e.target === this) fecharModal();
});

/* =====================
   SCRIPTS
===================== */

function setBtnRunning(id) {
  const btn = document.getElementById(id);
  if (btn) { btn.classList.add('running'); btn.classList.remove('done', 'error-state'); }
}

async function rodarSelecionados() {
  if (!selecionados.size) { showToast('Selecione ao menos um cliente', 'warn'); return; }
  setBtnRunning('btnSelecionados');
  setProgress(1);
  const lista = clientes.filter(c => selecionados.has(c.email));
  appendLog(`Iniciando execução para ${lista.length} cliente(s)...`);
  try {
    await fetch('/api/rodar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lista)
    });
  } catch(e) {
    showToast('Erro ao conectar ao servidor', 'error');
    document.getElementById('btnSelecionados').classList.remove('running');
  }
}

async function rodarGeral() {
  setBtnRunning('btnGeral');
  setProgress(1);
  appendLog('Iniciando execução geral (campanhas + listas)...');
  try {
    await fetch('/api/rodar-geral', { method: 'POST' });
  } catch(e) {
    showToast('Erro ao conectar ao servidor', 'error');
    document.getElementById('btnGeral').classList.remove('running');
  }
}

async function rodarCampanhas() {
  setBtnRunning('btnCampanhas');
  setProgress(1);
  appendLog('Iniciando script de campanhas...');
  try {
    await fetch('/api/rodar-campanhas', { method: 'POST' });
  } catch(e) {
    showToast('Erro ao conectar ao servidor', 'error');
    document.getElementById('btnCampanhas').classList.remove('running');
  }
}

async function rodarListas() {
  setBtnRunning('btnListas');
  setProgress(1);
  appendLog('Iniciando script de listas...');
  try {
    await fetch('/api/rodar-listas', { method: 'POST' });
  } catch(e) {
    showToast('Erro ao conectar ao servidor', 'error');
    document.getElementById('btnListas').classList.remove('running');
  }
}

async function rodarSincronizar() {
  setBtnRunning('btnSincronizar');
  setProgress(1);
  appendLog('Iniciando sincronização de listas (Adicionar/Retirar)...');
  try {
    await fetch('/api/sincronizar-listas', { method: 'POST' });
  } catch(e) {
    showToast('Erro ao conectar ao servidor', 'error');
    document.getElementById('btnSincronizar').classList.remove('running');
  }
}

/* =====================
   AGENDAMENTO
===================== */

function updateScheduleCountdown() {
  const now = new Date();
  const sp = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const target = new Date(sp);
  target.setHours(19, 0, 0, 0);
  if (sp >= target) target.setDate(target.getDate() + 1);

  const diff = target - sp;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const el = document.getElementById('scheduleNext');
  if (el) el.textContent = `Próxima em ${h}h ${m}min`;
}

updateScheduleCountdown();
setInterval(updateScheduleCountdown, 60000);

socket.on('cron-start', () => {
  const card = document.getElementById('scheduleCard');
  const status = document.getElementById('scheduleStatus');
  if (card) card.classList.add('running');
  if (status) status.textContent = 'Rodando';
  setBtnRunning('btnGeral');
  setProgress(1);
});

socket.on('cron-end', () => {
  const card = document.getElementById('scheduleCard');
  const status = document.getElementById('scheduleStatus');
  if (card) card.classList.remove('running');
  if (status) status.textContent = 'Ativo';
  updateScheduleCountdown();
});

/* =====================
   INIT
===================== */
carregarClientes();
