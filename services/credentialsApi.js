import axios from "axios";

const API_BASE_URL = process.env.CREDENTIALS_API_URL;
const API_KEY = process.env.CREDENTIALS_API_KEY;

function client() {
  if (!API_BASE_URL || !API_KEY) {
    throw new Error(
      "CREDENTIALS_API_URL e CREDENTIALS_API_KEY precisam estar definidos no ambiente."
    );
  }
  return axios.create({
    baseURL: API_BASE_URL,
    headers: { "X-API-Key": API_KEY },
  });
}

async function fetchActiveAccounts(http) {
  const accounts = [];
  let page = 1;
  const pageSize = 100;

  while (true) {
    const { data } = await http.get("/api/accounts", {
      params: { status: "ACTIVE", page, page_size: pageSize },
    });
    accounts.push(...data.items);
    if (accounts.length >= data.total || data.items.length === 0) break;
    page += 1;
  }

  return accounts;
}

async function fetchCredentials(http, accountId) {
  const { data } = await http.get(`/api/internal/accounts/${accountId}/credentials`);
  return data;
}

// Busca ao vivo (sem cache) — usada pelo passo 1 do formulário "Adicionar lista". Filtra por
// account.email no próprio sistema de credenciais (`q`, barato, não descriptografa nada) e só
// decripta a conta_snovio das poucas contas que já bateram no filtro, não da base inteira.
export async function searchActiveAccounts(query, limit = 15) {
  const http = client();
  const { data } = await http.get("/api/accounts", {
    params: { status: "ACTIVE", q: query, page: 1, page_size: limit },
  });

  const results = [];
  for (const account of data.items) {
    try {
      const creds = await fetchCredentials(http, account.id);
      results.push({ id: account.id, email: account.email, contaSnovio: creds.snov_email });
    } catch (err) {
      console.error(`Erro ao buscar credencial de ${account.email}:`, err.message);
    }
  }
  return results;
}

// Substitui a antiga leitura da aba "contas" do Google Sheets.
// Retorna o mesmo formato consumido pelos scripts: { email, clientId, clientSecret, emailSnovio, senha }
export async function getActiveClients() {
  const http = client();
  const accounts = await fetchActiveAccounts(http);

  const clients = [];
  for (const account of accounts) {
    const creds = await fetchCredentials(http, account.id);
    clients.push({
      id: account.id,
      email: account.email,
      clientId: creds.snov_id,
      clientSecret: creds.snov_secret,
      emailSnovio: creds.snov_email,
      senha: creds.snov_password,
    });
  }

  return clients;
}
