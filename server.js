import "dotenv/config";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import cron from "node-cron";

import { getClientes } from "./services/sheets.js";

import { main as rodarGeralScript } from "./scripts/geral.mjs";
import { main as rodarCampanhasScript } from "./scripts/relatoriocampanha1.mjs";
import { main as rodarListasScript } from "./scripts/relatorioListasv2.mjs";
import { main as rodarSincronizarScript } from "./scripts/sincronizarListas.mjs";
import { getRelatorioListas } from "./services/relatorioListasReader.js";
import {
  buscarContasSnovio,
  listarCampanhasPorConta,
  adicionarListaSquad,
  atualizarListaSquad,
} from "./services/listasSquadService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = 3000;

/* ===========================================
   ROTAS DE PÁGINA
   / -> dados do relatório (index.html, servido pelo static acima)
   /executar -> painel de execução dos scripts
=========================================== */

app.get("/executar", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "executar.html"));
});

app.get("/adicionar-lista", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "adicionar-lista.html"));
});

/* ===========================================
   Intercepta console.log dos scripts
   e repassa como eventos socket
=========================================== */
function createLogger(tag) {
  return {
    log: (...args) => {
      const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      io.emit("log", msg);
    },
    error: (...args) => {
      const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      io.emit("log", "ERRO: " + msg);
    },
    warn: (...args) => {
      const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      io.emit("log", "⚠ " + msg);
    }
  };
}

/* ===========================================
   SOCKET
=========================================== */

io.on("connection", (socket) => {
  console.log("Painel conectado");
});

/* ===========================================
   CLIENTES
=========================================== */

app.get("/api/clientes", async (req, res) => {
  try {
    const clientes = await getClientes();
    res.json(clientes);
  } catch (err) {
    console.error("Erro ao buscar clientes:", err);
    res.status(500).json({ error: "Erro ao buscar clientes" });
  }
});

/* ===========================================
   RODAR SELECIONADOS
=========================================== */

app.post("/api/rodar", async (req, res) => {
  const clientes = req.body;
  res.json({ status: "iniciado" });
  executarClientes(clientes);
});

// clientes chega no formato de /api/clientes (getClientes(): email/api1/api2/snovioMail/senha) —
// remapeia pro formato do sistema de credenciais (email/clientId/clientSecret/emailSnovio/senha)
// que relatoriocampanha1.mjs e relatorioListasv2.mjs esperam.
function paraFormatoCredenciais(clientes) {
  return clientes.map((c) => ({
    id: c.id,
    email: c.email,
    clientId: c.api1,
    clientSecret: c.api2,
    emailSnovio: c.snovioMail,
    senha: c.senha,
  }));
}

async function executarClientes(clientesSelecionados) {
  const total = clientesSelecionados.length;
  const clients = paraFormatoCredenciais(clientesSelecionados);

  io.emit("log", `━━━ Iniciando execução para ${total} cliente(s) ━━━`);
  io.emit("progresso", 5);

  try {
    io.emit("log", "→ Etapa 1: Campanhas...");
    await rodarCampanhasScript(clients);
    io.emit("log", "✔ Campanhas finalizadas");
    io.emit("progresso", 50);

    io.emit("log", "→ Etapa 2: Listas...");
    await rodarListasScript(clients);
    io.emit("log", "✔ Listas finalizadas");
    io.emit("progresso", 100);

    io.emit("status", { processados: total });
    io.emit("log", `━━━ Processo concluído: ${total} cliente(s) processado(s) ━━━`);
    io.emit("script-done", { btn: "btnSelecionados", msg: `${total} cliente(s) processado(s)` });
  } catch (err) {
    io.emit("log", `ERRO na execução dos selecionados: ${err.message}`);
    io.emit("script-error", { btn: "btnSelecionados", msg: "Erro ao processar clientes selecionados" });
  }
}

/* ===========================================
   RODAR GERAL
=========================================== */

app.post("/api/rodar-geral", async (req, res) => {
  res.json({ status: "ok" });

  io.emit("log", "━━━ Iniciando execução geral ━━━");
  io.emit("log", "→ Etapa 1: Campanhas...");

  try {
    await rodarGeralScript();
    io.emit("log", "✔ Geral finalizado");
    io.emit("script-done", { btn: "btnGeral", msg: "Execução geral concluída!" });
  } catch (err) {
    io.emit("log", "ERRO na execução geral: " + err.message);
    io.emit("script-error", { btn: "btnGeral", msg: "Erro na execução geral" });
  }
});

/* ===========================================
   RODAR CAMPANHAS
=========================================== */

app.post("/api/rodar-campanhas", async (req, res) => {
  res.json({ status: "ok" });

  io.emit("log", "━━━ Iniciando script de campanhas ━━━");

  try {
    await rodarCampanhasScript();
    io.emit("log", "✔ Campanhas finalizadas");
    io.emit("script-done", { btn: "btnCampanhas", msg: "Campanhas atualizadas!" });
  } catch (err) {
    io.emit("log", "ERRO nas campanhas: " + err.message);
    io.emit("script-error", { btn: "btnCampanhas", msg: "Erro ao rodar campanhas" });
  }
});

/* ===========================================
   RODAR LISTAS
=========================================== */

app.post("/api/rodar-listas", async (req, res) => {
  res.json({ status: "ok" });

  io.emit("log", "━━━ Iniciando script de listas ━━━");

  try {
    await rodarListasScript();
    io.emit("log", "✔ Listas finalizadas");
    io.emit("script-done", { btn: "btnListas", msg: "Listas verificadas!" });
  } catch (err) {
    io.emit("log", "ERRO nas listas: " + err.message);
    io.emit("script-error", { btn: "btnListas", msg: "Erro ao rodar listas" });
  }
});

/* ===========================================
   SINCRONIZAR LISTAS (Adicionar/Retirar)
=========================================== */

app.post("/api/sincronizar-listas", async (req, res) => {
  res.json({ status: "ok" });

  io.emit("log", "━━━ Iniciando sincronização de listas ━━━");

  try {
    await rodarSincronizarScript();
    io.emit("log", "✔ Sincronização finalizada");
    io.emit("script-done", { btn: "btnSincronizar", msg: "Listas sincronizadas!" });
  } catch (err) {
    io.emit("log", "ERRO na sincronização: " + err.message);
    io.emit("script-error", { btn: "btnSincronizar", msg: "Erro ao sincronizar listas" });
  }
});

/* ===========================================
   RELATÓRIO DE LISTAS (leitura da planilha)
=========================================== */

app.get("/api/relatorio-listas", async (req, res) => {
  try {
    const dados = await getRelatorioListas();
    res.json(dados);
  } catch (err) {
    console.error("Erro ao buscar relatório de listas:", err);
    res.status(500).json({ error: "Erro ao buscar relatório de listas" });
  }
});

/* ===========================================
   ADICIONAR LISTA (MySQL: contas_snovio / campanhas / listas_squad)
=========================================== */

app.get("/api/snovio/contas", async (req, res) => {
  const busca = (req.query.busca || "").trim();
  if (!busca) return res.json([]);
  try {
    const contas = await buscarContasSnovio(busca);
    res.json(contas);
  } catch (err) {
    console.error("Erro ao buscar contas Snovio:", err);
    res.status(500).json({ error: "Erro ao buscar contas Snovio" });
  }
});

app.get("/api/snovio/campanhas", async (req, res) => {
  const contaId = req.query.contaId;
  if (!contaId) return res.status(400).json({ error: "Parâmetro 'contaId' é obrigatório" });
  try {
    const campanhas = await listarCampanhasPorConta(contaId);
    res.json(campanhas);
  } catch (err) {
    console.error("Erro ao listar campanhas da conta:", err);
    res.status(500).json({ error: "Erro ao listar campanhas da conta" });
  }
});

app.post("/api/listas-squad", async (req, res) => {
  const { campanhaId, squad, contaEmail, disparos } = req.body || {};
  try {
    const resultado = await adicionarListaSquad({
      campanhaId,
      squad,
      contaEmail,
      disparos: Number(disparos),
    });
    if (!resultado.ok) return res.status(400).json({ error: resultado.erro });
    res.status(201).json({ status: "ok" });
  } catch (err) {
    console.error("Erro ao adicionar lista ao squad:", err);
    res.status(500).json({ error: "Erro ao adicionar lista ao squad" });
  }
});

app.patch("/api/listas-squad/:id", async (req, res) => {
  const { disparos, contaEmail } = req.body || {};
  try {
    const resultado = await atualizarListaSquad(req.params.id, {
      disparos: disparos !== undefined ? Number(disparos) : undefined,
      contaEmail,
    });
    if (!resultado.ok) return res.status(400).json({ error: resultado.erro });
    res.json({ status: "ok" });
  } catch (err) {
    console.error("Erro ao atualizar lista do squad:", err);
    res.status(500).json({ error: "Erro ao atualizar lista do squad" });
  }
});

/* ===========================================
   AGENDAMENTO DIÁRIO - 19h (Brasília)
=========================================== */

let cronRunning = false;

cron.schedule("0 19 * * *", async () => {
  if (cronRunning) {
    io.emit("log", "⚠ Agendamento ignorado — execução anterior ainda em andamento");
    return;
  }

  cronRunning = true;
  io.emit("log", "━━━ EXECUÇÃO AGENDADA (19h) ━━━");
  io.emit("log", "→ Iniciando execução geral automática...");
  io.emit("cron-start");

  try {
    await rodarGeralScript();
    io.emit("log", "✔ Execução agendada finalizada com sucesso");
    io.emit("script-done", { btn: "btnGeral", msg: "Execução agendada (19h) concluída!" });
  } catch (err) {
    io.emit("log", "ERRO na execução agendada: " + err.message);
    io.emit("script-error", { btn: "btnGeral", msg: "Erro na execução agendada" });
  } finally {
    cronRunning = false;
    io.emit("cron-end");
  }
}, {
  timezone: "America/Sao_Paulo"
});

console.log("Agendamento ativo: relatório geral diário às 19h (Brasília)");

app.get("/api/schedule-info", (req, res) => {
  res.json({ schedule: "Diário às 19:00", timezone: "America/Sao_Paulo", running: cronRunning });
});

/* ===========================================
   SERVIDOR
=========================================== */

server.listen(PORT, () => {
  console.log(`Servidor rodando → http://localhost:${PORT}`);
});