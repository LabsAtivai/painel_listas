import axios from "axios";
import { google } from "googleapis";
import { sheetsRead, sheetsWrite } from "../services/sheetsRateLimiter.js";
import { getActiveClients } from "../services/credentialsApi.js";

// Credenciais da conta de serviço
const credentials = {
  type: "service_account",
  project_id: "relatoriolistas",
  private_key_id: "e25ed131b297c4f1b9a88c500a6a92562ba9cab2",
  private_key:
    "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCpllxFoFzUmvIY\ncIx9QwYTQnSl68bJBy255ZU4Hd/tMJNlb7HDeACyp8X0V4ou2+bBczb1RZqEPtyi\n4kaKzPpz3e10mZfMBFIi37HtEi7IGi+IfrkUkVAXPKO68zT0nN63nGboErd91Dn4\nRvRgYxz0XDf1T74u7McGHjfhcsy5nu58SuHLhyxWZxlUlrdFSmSszdzKw1CKO8AZ\nq3HYId7iclyhmrZo360NDrPOVjDTy0Lb01K6dVw8TErVDgrxGwqMy/HXPmSZI+Tm\nX58oglkob/Iri3h7UODIxcR1MQ0IolRmkmvWw/RDL7MnnEpqTuV/FP7UTOWLSNun\n+7CUtBJpAgMBAAECggEAFBZG4WniWP3t41Jwd5VQ4sbeN3l3CyBuLHzauQID4C2+\n5bbOStl71q1762pTiCOcoGkP10s6Z0PlYSc1ZRMsrrz4l3UqZ1xTKMWPhwW+dA3y\n96NP85VXM9tnRtlwGjG7CStNvpsZ8B3rTGLGJyUSPMjwCV7bx2XdGJbLdmkhQfKV\nfHzlZPHTKSn37K9G9j1QvVTYqGvw020BzGgyfr5KoQcSsEFEE+Mu9p3HAwdSdty+\n8w56/NsDzan/D89zXEUlWhMEh8t0oTNXGrSWB7XiCHDXKVRYham+HE6kkVNL9qNj\neIWP+bMIjYt1p3N6DTzJwK1rJHFlyzzr4/+dMCxYcQKBgQDcHtwhHIWYDlnhkCxt\nLKRJ9oI7H7jjz+VglMx7S1KvxarIe+ue3RgRnntHV6aHaMPs8U5M2ria2pkscHDs\ny1QsoxGBerZ3gCB8LLlY6sT69iVUI+byVykgUDL/I6LRxw7TTBsNPesff+DCSdaL\nzU+ZNctUxkTq/2KBE8z4JBMj2QKBgQDFOtzVtFZcBC1zkZroRvuX+NsMGgS7XIGw\n92r8JFDMSjrPmc6XjR+Lk2vj+/ZIDAf7FECMv805EkLQs7RALaI9e03P+f3W21YR\nZpDxHi+uFaMmIG0BYbi6lBw7yne1wMEp4uiiZ5fgLM92y4oLi42Cj9TZDtNRCEeN\nxsrCr9KZEQKBgQCWA5ISHtYNIvqudwtP/DSbE5z9nkjrOSwh/ka9YEAh+pzBtXKG\n+jcFCvUJUfr0HbopKOssBYP6RTBO0PKk7o2XPisYCwF/v5pkBjbrGlTUlBwsk6s5\nTZ2BoCahKzAzt22rIxrsk15CQWxz/M5yyKGO0NKaG+WsIhCH127BThSdQQKBgCbD\nv/3c2RBy3cAWQT0gHnkrN1p0jrOIphDzQDrYpGzStiZxk5Jj8WxMiGsh7bERdEwc\nGefQFvT9qtY8S9RFY9rzrkKPXx3otEztPNW3WiW8KPnoa6RW4akCTV5PGCJIBW9H\nIvQwqkAsboZp0PMd9a1QucQDzvLhTrcF+Ho1do4RAoGAU5N2Lc9Ur3HYycoSZDGQ\nQ8i7dz549gYTOCeIRyxOKwaZe04yTHax6lrwWxThpSj9keP8d8Jjvu5gqtup9EAb\nTZgSKyoqmx3V02y4/+9FDxavoHVf/wVHMAzckQMcPAIkUkpsWOLNOI7pmetGaZEG\ng4P2NhbZYJNl7+QTbSfxQzU=\n-----END PRIVATE KEY-----\n",
  client_email: "ativarelatorio@relatoriolistas.iam.gserviceaccount.com",
  client_id: "101717739329184491985",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url:
    "https://www.googleapis.com/robot/v1/metadata/x509/ativarelatorio%40relatoriolistas.iam.gserviceaccount.com",
  universe_domain: "googleapis.com",
};

// Função para obter o token de acesso
async function getAccessToken(clientId, clientSecret) {
  try {
    const response = await axios.post(
      "https://api.snov.io/v1/oauth/access_token",
      {
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.error("Erro ao obter o token de acesso:", error);
    throw error;
  }
}

// Função para obter dados das campanhas da planilha "campanhas"
// READ único (compartilhado para todos os clientes do lote)
async function getAllCampaignData(sheets) {
  try {
    const spreadsheetId = "1IMH9GB0lmksuobxjGQmsVe1C2t04d1g-v9xEspnMKTY";
    const range = "campanhas";
    const response = await sheetsRead(() =>
      sheets.spreadsheets.values.get({ spreadsheetId, range })
    );

    return response.data.values || [];
  } catch (error) {
    console.error("Erro ao obter os dados das campanhas:", error);
    throw error;
  }
}

async function getCampaignProgress(accessToken, campaignId) {
  try {
    const response = await axios.get(
      `https://api.snov.io/v2/campaigns/${campaignId}/progress`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
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

/**
 * BATCH UPDATE — substitui N chamadas update individuais por uma única
 * chamada batchUpdate com todos os ranges acumulados do lote.
 */
async function batchUpdateUnfinished(sheets, updateRequests) {
  if (updateRequests.length === 0) return;

  const spreadsheetId = "1IMH9GB0lmksuobxjGQmsVe1C2t04d1g-v9xEspnMKTY";

  // A API aceita até 1000 ranges por batchUpdate — subdividir se necessário
  const CHUNK = 100;
  for (let i = 0; i < updateRequests.length; i += CHUNK) {
    const chunk = updateRequests.slice(i, i + CHUNK);

    await sheetsWrite(() =>
      sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        resource: {
          valueInputOption: "RAW",
          data: chunk, // array de { range, values }
        },
      })
    );

    console.log(
      `✅ batchUpdate: ${chunk.length} linha(s) gravadas (chunk ${Math.floor(i / CHUNK) + 1})`
    );
  }
}

// Função para pausar a execução
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Função principal
export async function main() {
  try {
    const auth = await google.auth.getClient({
      credentials,
      scopes: "https://www.googleapis.com/auth/spreadsheets",
    });

    const sheets = google.sheets({ version: "v4", auth });
    const clients = await getActiveClients();
    console.log("Clientes extraídos:", clients.length);
    const usersHasError = [];

    // 1 READ para buscar todas as campanhas (ao invés de 1 por cliente)
    const allCampaignRows = await getAllCampaignData(sheets);

    // batchSize = 27: cada cliente gera 1 chamada Snov.io (sem custo de quota)
    // Os writes são batched, então o único custo de quota é o batchUpdate final por lote
    const batchSize = 27;

    for (let i = 0; i < clients.length; i += batchSize) {
      const batch = clients.slice(i, i + batchSize);
      console.log(`Processando lote de ${batch.length} clientes...`);

      // Acumula todos os ranges para um único batchUpdate no final do lote
      const updateRequests = [];

      for (const client of batch) {
        try {
          const accessToken = await getAccessToken(client.clientId, client.clientSecret);

          // Filtrar as campanhas deste cliente a partir dos dados já lidos
          const campaignData = allCampaignRows
            .filter((row) => row[1] == client.email)
            .map((row) => ({ id: row[2], name: row[3] }));

          for (const campaign of campaignData) {
            try {
              const progress = await getCampaignProgress(accessToken, campaign.id);
              const unfinished = progress.unfinished || 0;

              // Descobrir a próxima linha disponível na aba "unfinished"
              // Nota: fazemos um único GET da aba no início do lote para evitar N reads
              updateRequests.push({
                // Usaremos append via batchUpdate append-style: acumular e depois
                // decidir o range exato. Como não sabemos a linha sem um GET,
                // usaremos o método append depois de tudo acumulado.
                _clientEmail: client.email,
                _campaignId: campaign.id,
                _campaignName: campaign.name,
                _unfinished: unfinished,
              });

              console.log(
                `  ✔ campaignID ${campaign.id} | unfinished: ${unfinished} | cliente: ${client.email}`
              );
            } catch (error) {
              console.error(
                `Erro ao processar campanha ${campaign.id} do cliente ${client.email}:`,
                error
              );
            }
          }
        } catch (error) {
          usersHasError.push(client);
          console.error("Erro na execução para cliente:", client.email, error);
        }
      }

      // Converter os requests acumulados em um único append batch
      if (updateRequests.length > 0) {
        const spreadsheetId = "1IMH9GB0lmksuobxjGQmsVe1C2t04d1g-v9xEspnMKTY";
        const sheetName = "unfinished";

        // 1 READ para saber a última linha (ao invés de 1 por campanha)
        const getRows = await sheetsRead(() =>
          sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A:A`,
          })
        );

        let nextRow = getRows.data.values ? getRows.data.values.length + 1 : 1;

        // Montar os ranges de cada linha em sequência
        const batchData = updateRequests.map((req) => {
          const range = `${sheetName}!A${nextRow}:D${nextRow}`;
          nextRow++;
          return {
            range,
            values: [[req._campaignId, req._campaignName, req._unfinished, req._clientEmail]],
          };
        });

        // 1 WRITE para o lote inteiro
        await batchUpdateUnfinished(sheets, batchData);
        console.log(`✅ Lote gravado: ${batchData.length} linha(s) em unfinished`);
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
