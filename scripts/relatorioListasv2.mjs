import axios from "axios";
import { getActiveClients } from "../services/credentialsApi.js";
import { getPool } from "../services/db.js";
import { getCampanhasPorConta, atualizarAtivosRestantes } from "../services/snovioCache.js";
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

async function getCampaignProgress(accessToken, campaignId) {
  try {
    const response = await snovio(() =>
      axios.get(`https://api.snov.io/v2/campaigns/${campaignId}/progress`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    );
    return response.data;
  } catch (error) {
    console.error(
      "Erro ao buscar progresso da campanha:",
      error.response?.data || error.message
    );
    throw error;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Função principal
// clientesSelecionados: lista opcional de clientes (formato getActiveClients: id, email,
// clientId, clientSecret, emailSnovio, senha) — usada pelo painel para "Rodar selecionados".
// Sem argumento, roda pra todos os clientes ativos do sistema de credenciais (comportamento
// padrão/agendado). Lê a lista de campanhas de cada conta do MySQL (populada por
// relatoriocampanha1.mjs) e grava o "ativos restantes" atualizado de volta no MySQL — não usa
// mais Google Sheets.
export async function main(clientesSelecionados) {
  const pool = getPool();

  try {
    const clients = clientesSelecionados?.length ? clientesSelecionados : await getActiveClients();
    console.log("Clientes extraídos:", clients.length);
    const usersHasError = [];

    // batchSize = 27: cada cliente gera 1 chamada de token + N chamadas de progresso ao Snov.io
    const batchSize = 27;

    for (let i = 0; i < clients.length; i += batchSize) {
      const batch = clients.slice(i, i + batchSize);
      console.log(`Processando lote de ${batch.length} clientes...`);

      for (const client of batch) {
        try {
          const accessToken = await getAccessToken(client.clientId, client.clientSecret);
          const campanhas = await getCampanhasPorConta(pool, client.id);

          for (const campanha of campanhas) {
            try {
              const progress = await getCampaignProgress(accessToken, campanha.id);
              const unfinished = progress.unfinished || 0;

              await atualizarAtivosRestantes(pool, campanha.id, unfinished);

              console.log(
                `  ✔ campaignID ${campanha.id} | ativos restantes: ${unfinished} | cliente: ${client.email}`
              );
            } catch (error) {
              console.error(
                `Erro ao processar campanha ${campanha.id} do cliente ${client.email}:`,
                error
              );
            }
          }
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
      console.warn("Usuários com erros:");
      usersHasError.forEach((client) => console.warn(`${client.emailSnovio}`));
      console.warn("---------------------------------------------------------");
    }
  } catch (error) {
    console.error("Erro na execução principal:", error);
  }
}
