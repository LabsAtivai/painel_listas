import axios from "axios";
import { getActiveClients } from "../services/credentialsApi.js";
import { getPool } from "../services/db.js";
import { upsertContaSnovio, upsertCampanhas } from "../services/snovioCache.js";
import { snovio } from "../services/snovioRateLimiter.js";

async function getAccessToken(clientId, clientSecret) {
  try {
    const response = await snovio(() =>
      axios.post("https://api.snov.io/v1/oauth/access_token", {
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      })
    );
    return response.data.access_token;
  } catch (error) {
    console.error("Erro ao obter o token de acesso:", error);
    throw error;
  }
}

async function getCampaignName(accessToken) {
  try {
    const response = await snovio(() =>
      axios.get("https://api.snov.io/v1/get-user-campaigns", {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    );
    return response.data;
  } catch (error) {
    console.error(
      "Erro ao obter informações da campanha:",
      error.response?.errors || error.message
    );
    throw error;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const usersHasError = [];

// clientesSelecionados: lista opcional de clientes (formato getActiveClients: id, email,
// clientId, clientSecret, emailSnovio, senha) — usada pelo painel para "Rodar selecionados".
// Sem argumento, roda pra todos os clientes ativos do sistema de credenciais (comportamento
// padrão/agendado). Grava a lista de campanhas de cada conta em contas_snovio/campanhas
// (MySQL) — não usa mais Google Sheets.
export async function main(clientesSelecionados) {
  const pool = getPool();

  try {
    const clients = clientesSelecionados?.length ? clientesSelecionados : await getActiveClients();

    // batchSize = 55 mantém a mesma janela de req/min que já era usada com o Sheets
    const batchSize = 55;

    for (let i = 0; i < clients.length; i += batchSize) {
      const batch = clients.slice(i, i + batchSize);
      console.log(`Processando lote de ${batch.length} clientes...`);

      for (const client of batch) {
        try {
          const accessToken = await getAccessToken(client.clientId, client.clientSecret);
          const campaignData = await getCampaignName(accessToken);

          await upsertContaSnovio(pool, client);
          await upsertCampanhas(pool, client.id, campaignData);

          console.log(`✅ ${campaignData.length} campanha(s) sincronizada(s) — ${client.email}`);
        } catch (error) {
          usersHasError.push(client);
          console.error("Erro na execução para cliente:", client.email, error);
        }
      }

      if (i + batchSize < clients.length) {
        console.log("Aguardando antes de processar o próximo lote...");
        await sleep(60_000);
      }
    }

    if (usersHasError.length) {
      console.warn("---------------------------------------------------------");
      console.warn("Usuários com erros: ");
      usersHasError.forEach((x) => console.warn(`${x.emailSnovio}`));
      console.warn("---------------------------------------------------------");
    }
  } catch (error) {
    console.error("Erro na execução principal:", error);
  }
}
