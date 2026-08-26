import { getPool } from "./db.js";

// Espelha (upsert) uma conta ativa do sistema de credenciais em contas_snovio.
// Não guarda segredo nenhum — só id/e-mails/status, pra poder referenciar campanhas por conta
// e pro formulário de adicionar lista confirmar "essa conta existe e tem credencial".
export async function upsertContaSnovio(pool, client) {
  await pool.query(
    `INSERT INTO contas_snovio (id, email, conta_snovio, status, sincronizado_em)
     VALUES (?, ?, ?, 'ACTIVE', ?)
     ON DUPLICATE KEY UPDATE email = VALUES(email), status = 'ACTIVE', sincronizado_em = VALUES(sincronizado_em)`,
    [client.id, client.email, client.emailSnovio, new Date()]
  );
}

// Upsert em lote das campanhas de uma conta (resultado de GET /v1/get-user-campaigns).
export async function upsertCampanhas(pool, contaId, campanhas) {
  if (!campanhas.length) return;
  const agora = new Date();

  const values = campanhas.map((c) => [
    c.id,
    contaId,
    String(c.campaign ?? c.name ?? c.title ?? ""),
    c.list_id ?? null,
    c.status ?? null,
    agora,
  ]);

  await pool.query(
    `INSERT INTO campanhas (id, conta_id, nome, list_id, status_snovio, sincronizado_em)
     VALUES ?
     ON DUPLICATE KEY UPDATE
       nome = VALUES(nome),
       list_id = VALUES(list_id),
       status_snovio = VALUES(status_snovio),
       sincronizado_em = VALUES(sincronizado_em)`,
    [values]
  );
}

// Atualiza o último valor conhecido de ativos restantes de uma campanha (get-campaign-progress).
export async function atualizarAtivosRestantes(pool, campaignId, ativosRestantes) {
  await pool.query(
    `UPDATE campanhas SET ativos_restantes = ?, sincronizado_em = ? WHERE id = ?`,
    [ativosRestantes, new Date(), campaignId]
  );
}

// Campanhas já cacheadas de uma conta (usado por relatorioListasv2.mjs em vez de ler o Sheets).
export async function getCampanhasPorConta(pool, contaId) {
  const [rows] = await pool.query(
    `SELECT id, nome FROM campanhas WHERE conta_id = ?`,
    [contaId]
  );
  return rows;
}
