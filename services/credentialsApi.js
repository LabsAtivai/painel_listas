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

// Substitui a antiga leitura da aba "contas" do Google Sheets.
// Retorna o mesmo formato consumido pelos scripts: { email, clientId, clientSecret, emailSnovio, senha }
export async function getActiveClients() {
  const http = client();
  const accounts = await fetchActiveAccounts(http);

  const clients = [];
  for (const account of accounts) {
    const creds = await fetchCredentials(http, account.id);
    clients.push({
      email: account.email,
      clientId: creds.snov_id,
      clientSecret: creds.snov_secret,
      emailSnovio: creds.snov_email,
      senha: creds.snov_password,
    });
  }

  return clients;
}
