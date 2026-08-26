import { getPool } from "./db.js";

const SQUADS = ["Onboarding", "SDR REMOTO", "Geral"];

// Soma/subtrai dias úteis (equivalente ao WORKDAY.INTL usado antes na planilha) —
// pula sábado/domingo, sem calendário de feriados.
function addBusinessDays(startDate, days) {
  const result = new Date(startDate);
  const step = days >= 0 ? 1 : -1;
  let remaining = Math.round(Math.abs(days));

  while (remaining > 0) {
    result.setDate(result.getDate() + step);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) remaining--;
  }
  return result;
}

function formatarData(date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

async function getSquad(pool, squad) {
  const [rows] = await pool.query(
    `SELECT
       ls.id AS listaSquadId,
       c.id AS campaignId,
       c.nome AS campanha,
       ls.conta_email AS contaEmail,
       cs.conta_snovio AS clienteConta,
       ls.disparos AS disparos,
       c.ativos_restantes AS ativosRestantes,
       ls.status AS statusLista
     FROM listas_squad ls
     JOIN campanhas c ON c.id = ls.campanha_id
     JOIN contas_snovio cs ON cs.id = c.conta_id
     WHERE ls.squad = ?
     ORDER BY ls.criado_em DESC`,
    [squad]
  );

  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);

  let linhasComErro = 0;

  const linhas = rows.map((row) => {
    const semDado = row.ativosRestantes == null || !row.disparos;
    const diasRestantes = semDado ? null : row.ativosRestantes / row.disparos;
    const dataPrevista = diasRestantes == null ? null : formatarData(addBusinessDays(ontem, diasRestantes));

    if (semDado) linhasComErro++;

    return {
      status: semDado ? "erro" : "ok",
      listaSquadId: row.listaSquadId,
      campaignId: String(row.campaignId),
      campanha: row.campanha,
      contaEmail: row.contaEmail,
      clienteConta: row.clienteConta,
      disparos: row.disparos,
      ativosRestantes: row.ativosRestantes,
      diasRestantes,
      dataPrevista,
      statusLista: row.statusLista,
    };
  });

  return { squad, totalLinhas: linhas.length, linhasComErro, linhas };
}

export async function getRelatorioListas() {
  const pool = getPool();

  const resultados = await Promise.all(SQUADS.map((squad) => getSquad(pool, squad)));
  const porSquad = Object.fromEntries(SQUADS.map((squad, i) => [squad, resultados[i]]));

  return {
    geradoEm: new Date().toISOString(),
    squads: {
      Onboarding: porSquad["Onboarding"],
      Geral: porSquad["Geral"],
      "SDR REMOTO": porSquad["SDR REMOTO"],
    },
  };
}
