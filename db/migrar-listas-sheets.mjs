// Migração única: lê as abas Onboarding/SDR REMOTO/Geral do Google Sheets (fonte antiga) e
// insere em listas_squad (MySQL, fonte atual) as campanhas que já batem com o cache de
// campanhas sincronizado do Snov.io. Não escreve nada de volta no Sheets — só leitura lá.
import "dotenv/config";
import { google } from "googleapis";
import { credentials } from "../scripts/sincronizarListas.mjs";
import { getPool } from "../services/db.js";

const PLANILHA_RELATORIOS = "1IMH9GB0lmksuobxjGQmsVe1C2t04d1g-v9xEspnMKTY";
const ERR_PREFIXES = ["#REF!", "#N/A", "#DIV/0!", "#VALUE!", "#NAME?", "#NULL!", "#NUM!", "#ERROR!"];

function isErro(v) {
  return typeof v === "string" && ERR_PREFIXES.some((p) => v.trim().startsWith(p));
}

function findHeaderRowIndex(rows) {
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const row = rows[i] || [];
    if (row.some((cell) => String(cell ?? "").trim().toLowerCase().startsWith("disparos"))) return i;
  }
  return -1;
}

async function getSheetsClient() {
  const auth = await google.auth.getClient({
    credentials,
    scopes: "https://www.googleapis.com/auth/spreadsheets.readonly",
  });
  return google.sheets({ version: "v4", auth });
}

async function migrarSquad(sheets, pool, abaSheet, squadDestino) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: PLANILHA_RELATORIOS,
    range: abaSheet,
  });
  const rows = res.data.values || [];
  const headerIdx = findHeaderRowIndex(rows);
  if (headerIdx === -1) {
    console.log(`  [${squadDestino}] cabeçalho não encontrado, pulando aba inteira`);
    return { inseridas: 0, semCampanhaId: 0, naoEncontradas: 0, jaExistiam: 0 };
  }

  let inseridas = 0, semCampanhaId = 0, naoEncontradas = 0, jaExistiam = 0;

  for (let r = headerIdx + 2; r < rows.length; r++) {
    const row = rows[r] || [];
    const campaignIdRaw = row[0];
    const contaEmail = row[2];
    const disparos = row[4];

    if (campaignIdRaw === undefined || campaignIdRaw === "" || isErro(campaignIdRaw)) {
      semCampanhaId++;
      continue;
    }
    const campaignId = Number(campaignIdRaw);
    if (!Number.isFinite(campaignId) || !contaEmail || !disparos) {
      semCampanhaId++;
      continue;
    }

    const [existe] = await pool.query("SELECT id FROM campanhas WHERE id = ?", [campaignId]);
    if (!existe.length) {
      naoEncontradas++;
      continue;
    }

    try {
      const [result] = await pool.query(
        `INSERT INTO listas_squad (campanha_id, squad, conta_email, disparos, status)
         VALUES (?, ?, ?, ?, 'ativa')`,
        [campaignId, squadDestino, String(contaEmail).trim(), Number(disparos) || 0]
      );
      if (result.affectedRows) inseridas++;
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") jaExistiam++;
      else throw err;
    }
  }

  return { inseridas, semCampanhaId, naoEncontradas, jaExistiam };
}

async function main() {
  const sheets = await getSheetsClient();
  const pool = getPool();

  const alvos = [
    { aba: "Onboarding", squad: "Onboarding" },
    { aba: "'SDR REMOTO'", squad: "SDR REMOTO" },
    { aba: "Geral", squad: "Geral" },
  ];

  for (const { aba, squad } of alvos) {
    console.log(`→ Migrando ${squad}...`);
    const r = await migrarSquad(sheets, pool, aba, squad);
    console.log(
      `  ✔ ${squad}: ${r.inseridas} inseridas | ${r.jaExistiam} já existiam | ${r.naoEncontradas} campanha não encontrada no cache | ${r.semCampanhaId} linha sem dado válido`
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Erro na migração:", err);
  process.exit(1);
});
