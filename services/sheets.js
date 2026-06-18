import { google } from "googleapis";
import { sheetsRead } from "./sheetsRateLimiter.js";

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

export async function getClientes() {
  const auth = await google.auth.getClient({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = "1u4rMoTUQz0w_g92xmV8_pjtVc8JtKLLH7v090V5lq40";

  const res = await sheetsRead(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "contas",
    })
  );

  const rows = res.data.values;
  const clientes = [];

  rows.forEach((row, index) => {
    if (index === 0) return;
    clientes.push({
      email: row[1],
      api1: row[2],
      api2: row[3],
      snovioMail: row[4],
      senha: row[5],
    });
  });

  return clientes;
}
