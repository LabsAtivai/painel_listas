import { getPool } from "./db.js";
import { searchActiveAccounts } from "./credentialsApi.js";

// Busca ao vivo no sistema de credenciais — não usa a tabela contas_snovio (que só serve de
// cache pra campanhas/relatório). Sempre atualizado, sem esperar rodar "Campanhas".
export async function buscarContasSnovio(busca) {
  return searchActiveAccounts(busca);
}

export async function listarCampanhasPorConta(contaId) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT id, nome, status_snovio AS statusSnovio
     FROM campanhas
     WHERE conta_id = ?
     ORDER BY nome`,
    [contaId]
  );
  return rows;
}

const SQUADS_VALIDOS = new Set(["Onboarding", "SDR REMOTO", "Geral"]);

export async function adicionarListaSquad({ campanhaId, squad, contaEmail, disparos }) {
  if (!campanhaId || !SQUADS_VALIDOS.has(squad) || !contaEmail || !disparos) {
    return { ok: false, erro: "Campos obrigatórios faltando ou squad inválido." };
  }

  const pool = getPool();
  try {
    await pool.query(
      `INSERT INTO listas_squad (campanha_id, squad, conta_email, disparos, status)
       VALUES (?, ?, ?, ?, 'ativa')`,
      [campanhaId, squad, contaEmail.trim(), disparos]
    );
    return { ok: true };
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return { ok: false, erro: "Essa campanha já está nesse squad." };
    }
    throw err;
  }
}
