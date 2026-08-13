import axios from "axios";
import { google } from "googleapis";
import { sheetsWrite } from "../services/sheetsRateLimiter.js";
import { getActiveClients } from "../services/credentialsApi.js";

const credentials = {
  type: "service_account",
  project_id: "relatoriolistas",
  private_key_id: "6c5c1443fd668bd0fc31616f485d8e7a3d27dc4b",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDFAQu2jNx1DiwE\nLI5RL6LmAR9X/YKBlL4YEoWi2Utp0hPQX7/GsAE5i5jaY6stoQWFv5F9voYVN0fL\nFDL7mjn9q9RZ+ZeRFrq5rOqJqmYXiUiWXVe6s5l6u8tqjkiDJ3ruPnUnHIqlM5G5\n3PBbKbwNbPIjg0iHNIoc3nm34lpjVtHubbBkWdSEmqnkNgI4L+mu5MRFlYQg+iYa\nBF7lP6UGUSf/rxzz6qld5AeKNHXRVQ6Stq51pFueP6SZ5nAqFotc/lLBxJMiiTd7\nuGYzeMG6T2QJhVoSZjxQiZbxkET1HF8HByjauEpXPmMBrqZ46m6LIR3vzHztTK8I\nsBqV7vKhAgMBAAECggEACLkxIZY/NNe5zz2B18p6NiEamDTbkI1blYlMbZedpUPu\nKK30ugGVLE0oKZN8Qvr8WZ3P/XdwTIQ0I6PzVfzQUJFJR+qrcXtGLW6gvBPVjXlA\nw5fCiLvnMe4a5c8DGvumj+IoIeE7qnEMJOTJp9/DOfz3A+eOUJ5c90ZKsX/ObNOZ\neGSm2na5w6FQAi5/jn3YsmjpXI537j4aLbKZys23a+FpzKGt+G0ZlFPr0Qq4XmC5\nYzFC9YNr3PMdtCz/D52lSAp72M+ficj6VgTVhDgPeP82CtpzFci5ciU1fNF7r8sw\n2PgoPkgAWzmklnFQe45dy7sygXz82p+P+3tGfzcgWQKBgQDi9aLbJSoNxzxtSpH8\nuBbMUDPNLCUPon2ZZNeJbyq28YGFXnYYm6DRRn5nhf8LP6tqPMqPB0HlTI7qlqQ4\nLstTXa62Yvbcwh5n1JLDYT+kNEEqI5Bu/2JplI9JIWf9kI54ME8fz3OORz59Rntt\nWUjH5yig3hMVB+Jj66oDmlw4hwKBgQDeNi3gcJ/KD31R/ik/z7iArWniU9pFJept\nrHYY6PsmwDo6LeIpCHKZVTEJQp4XX6L1UwrO6SV47s2afoWBf7r/Cb22i0+Iu8Mx\nIXx7CBJT8n/ujpSXx1ffLyD5eiZ4U+R46KBJZv2Tum5b7ozEmloT15O54IuA+8j7\noLTB5m9NlwKBgE0NrC7OnUp0O/W2/X1ZWpQfHpcnx6VZO18at3p3fX8C20BWY63T\nGHQ0hLHM8lv1T9MPtI1+n0akCVlnr3VLncg95BUT4E/ur7f8mZ8voxWyj/Uogd7N\nYbIKt+LSLqYNr/DqJdLc8ZR6Z6LMjRcA2w7TUh3bh4r6VEgsOFpky659AoGAYFWk\ntfSdkX/9mJpTT7LCDicgDFrF+cxiQYHPASWgHECh/a7+qUNcS1U/mQAkgYWYpDqI\nKQOylycQQ7YuMuIpM4AJmyXyKRkdmiMmUEBDkdlD1SxDBzoIwl0wMnfeTbQxDKnt\nM2VO8ciVJ43XwTQZcRi4lpDeaeC+VThqpNU906kCgYAYtZg+oWeOAsGU85DN1Ze9\nL7DHXHctQtschSpRubGWuPA6lQ/3c8RHGPj63ljNb53Q/FS8muOSdQOh/+GnMHHv\ntSg3MMeZ3Z+EIxCKxFfADRFGK7PUOBDY36ZzbRvh/iiCFQEZ/dE+wt0tnEH63L7r\nYcB0t80yDQiLytIKOE38uA==\n-----END PRIVATE KEY-----\n",
  client_email: "ativarelatorio@relatoriolistas.iam.gserviceaccount.com",
  client_id: "101717739329184491985",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url:
    "https://www.googleapis.com/robot/v1/metadata/x509/ativarelatorio%40relatoriolistas.iam.gserviceaccount.com",
  universe_domain: "googleapis.com",
};

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

/**
 * BATCH APPEND — uma única chamada ao Sheets por lote de clientes,
 * em vez de uma chamada por cliente (evita estourar o limite de writes).
 */
async function batchAppendToGoogleSheets(sheets, allValues) {
  if (allValues.length === 0) return;

  try {
    const spreadsheetId = "1IMH9GB0lmksuobxjGQmsVe1C2t04d1g-v9xEspnMKTY";
    const range = "campanhas";

    await sheetsWrite(() =>
      sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        resource: { values: allValues },
      })
    );

    console.log(`✅ ${allValues.length} linha(s) adicionadas ao Sheets em uma única chamada`);
  } catch (error) {
    console.error("Erro ao fazer batch append ao Google Sheets:", error);
  }
}

async function getCampaignName(accessToken) {
  try {
    const response = await axios.get(
      "https://api.snov.io/v1/get-user-campaigns",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
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

export async function main() {
  try {
    const auth = await google.auth.getClient({
      credentials,
      scopes: "https://www.googleapis.com/auth/spreadsheets",
    });

    const sheetsClient = google.sheets({ version: "v4", auth });
    const clients = await getActiveClients();

    // batchSize = 55 garante que os reads (1 por cliente) + o append final
    // caibam dentro de 60 req/min com margem de segurança
    const batchSize = 55;

    for (let i = 0; i < clients.length; i += batchSize) {
      const batch = clients.slice(i, i + batchSize);
      console.log(`Processando lote de ${batch.length} clientes...`);

      // Acumula todas as linhas do lote para fazer 1 único append no final
      const batchValues = [];
      const today = new Date().toISOString().split("T")[0];

      for (const client of batch) {
        try {
          const accessToken = await getAccessToken(client.clientId, client.clientSecret);
          const campaignData = await getCampaignName(accessToken);

          for (const campaign of campaignData) {
            batchValues.push([
              today,
              client.email,
              campaign.id,
              campaign.campaign || campaign,
              campaign.list_id,
              campaign.status,
              campaign.created_at,
              campaign.updated_at,
              campaign.started_at,
              campaign.hash,
            ]);
          }
        } catch (error) {
          usersHasError.push(client);
          console.error("Erro na execução para cliente:", client.email, error);
        }
      }

      // 1 write para o lote inteiro (independente de quantos clientes/campanhas)
      await batchAppendToGoogleSheets(sheetsClient, batchValues);

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
