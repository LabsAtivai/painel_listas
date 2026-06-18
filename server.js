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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = 3000;

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

async function executarClientes(clientes) {
  const total = clientes.length;
  let atual = 0;
  let erros = 0;

  io.emit("log", `━━━ Iniciando execução para ${total} cliente(s) ━━━`);

  for (const cliente of clientes) {
    atual++;
    io.emit("log", `→ Processando: ${cliente.email}`);

    try {
      /* Chame aqui seu script real por cliente, ex:
         await rodarScriptPorCliente(cliente);
      */
      await new Promise(r => setTimeout(r, 1500));
      io.emit("log", `✔ Finalizado: ${cliente.email}`);
      io.emit("status", { processados: atual });
    } catch (err) {
      erros++;
      io.emit("log", `ERRO em ${cliente.email}: ${err.message}`);
      io.emit("status", { erros });
    }

    const progresso = Math.round((atual / total) * 100);
    io.emit("progresso", progresso);
  }

  io.emit("log", `━━━ Processo concluído: ${atual - erros}/${total} com sucesso ━━━`);
  io.emit("script-done", { btn: "btnSelecionados", msg: `${atual - erros}/${total} clientes processados` });
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