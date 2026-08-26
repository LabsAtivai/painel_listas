import { google } from "googleapis";
import { sheetsRead, sheetsWrite } from "../services/sheetsRateLimiter.js";

export const credentials = {
  type: "service_account",
  project_id: "relatoriolistas",
  private_key_id: "6c5c1443fd668bd0fc31616f485d8e7a3d27dc4b",
  private_key:
    "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDFAQu2jNx1DiwE\nLI5RL6LmAR9X/YKBlL4YEoWi2Utp0hPQX7/GsAE5i5jaY6stoQWFv5F9voYVN0fL\nFDL7mjn9q9RZ+ZeRFrq5rOqJqmYXiUiWXVe6s5l6u8tqjkiDJ3ruPnUnHIqlM5G5\n3PBbKbwNbPIjg0iHNIoc3nm34lpjVtHubbBkWdSEmqnkNgI4L+mu5MRFlYQg+iYa\nBF7lP6UGUSf/rxzz6qld5AeKNHXRVQ6Stq51pFueP6SZ5nAqFotc/lLBxJMiiTd7\nuGYzeMG6T2QJhVoSZjxQiZbxkET1HF8HByjauEpXPmMBrqZ46m6LIR3vzHztTK8I\nsBqV7vKhAgMBAAECggEACLkxIZY/NNe5zz2B18p6NiEamDTbkI1blYlMbZedpUPu\nKK30ugGVLE0oKZN8Qvr8WZ3P/XdwTIQ0I6PzVfzQUJFJR+qrcXtGLW6gvBPVjXlA\nw5fCiLvnMe4a5c8DGvumj+IoIeE7qnEMJOTJp9/DOfz3A+eOUJ5c90ZKsX/ObNOZ\neGSm2na5w6FQAi5/jn3YsmjpXI537j4aLbKZys23a+FpzKGt+G0ZlFPr0Qq4XmC5\nYzFC9YNr3PMdtCz/D52lSAp72M+ficj6VgTVhDgPeP82CtpzFci5ciU1fNF7r8sw\n2PgoPkgAWzmklnFQe45dy7sygXz82p+P+3tGfzcgWQKBgQDi9aLbJSoNxzxtSpH8\nuBbMUDPNLCUPon2ZZNeJbyq28YGFXnYYm6DRRn5nhf8LP6tqPMqPB0HlTI7qlqQ4\nLstTXa62Yvbcwh5n1JLDYT+kNEEqI5Bu/2JplI9JIWf9kI54ME8fz3OORz59Rntt\nWUjH5yig3hMVB+Jj66oDmlw4hwKBgQDeNi3gcJ/KD31R/ik/z7iArWniU9pFJept\nrHYY6PsmwDo6LeIpCHKZVTEJQp4XX6L1UwrO6SV47s2afoWBf7r/Cb22i0+Iu8Mx\nIXx7CBJT8n/ujpSXx1ffLyD5eiZ4U+R46KBJZv2Tum5b7ozEmloT15O54IuA+8j7\noLTB5m9NlwKBgE0NrC7OnUp0O/W2/X1ZWpQfHpcnx6VZO18at3p3fX8C20BWY63T\nGHQ0hLHM8lv1T9MPtI1+n0akCVlnr3VLncg95BUT4E/ur7f8mZ8voxWyj/Uogd7N\nYbIKt+LSLqYNr/DqJdLc8ZR6Z6LMjRcA2w7TUh3bh4r6VEgsOFpky659AoGAYFWk\ntfSdkX/9mJpTT7LCDicgDFrF+cxiQYHPASWgHECh/a7+qUNcS1U/mQAkgYWYpDqI\nKQOylycQQ7YuMuIpM4AJmyXyKRkdmiMmUEBDkdlD1SxDBzoIwl0wMnfeTbQxDKnt\nM2VO8ciVJ43XwTQZcRi4lpDeaeC+VThqpNU906kCgYAYtZg+oWeOAsGU85DN1Ze9\nL7DHXHctQtschSpRubGWuPA6lQ/3c8RHGPj63ljNb53Q/FS8muOSdQOh/+GnMHHv\ntSg3MMeZ3Z+EIxCKxFfADRFGK7PUOBDY36ZzbRvh/iiCFQEZ/dE+wt0tnEH63L7r\nYcB0t80yDQiLytIKOE38uA==\n-----END PRIVATE KEY-----\n",
  client_email: "ativarelatorio@relatoriolistas.iam.gserviceaccount.com",
  client_id: "101717739329184491985",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url:
    "https://www.googleapis.com/robot/v1/metadata/x509/ativarelatorio%40relatoriolistas.iam.gserviceaccount.com",
  universe_domain: "googleapis.com",
};

export const PLANILHA_ATUALIZACAO = "19xZbODwwgq8fLYW5v0JNKJSEOM0iA69wT_90_VW9tE0";
const PLANILHA_RELATORIOS = "1IMH9GB0lmksuobxjGQmsVe1C2t04d1g-v9xEspnMKTY";

function mapSquadToTab(squad) {
  const normalized = (squad || "").trim().toLowerCase();
  if (normalized === "geral") return "Geral";
  if (normalized === "onbording" || normalized === "onboarding") return "Onboarding";
  if (normalized === "sdr" || normalized === "sdr remoto") return "SDR REMOTO";
  if (normalized === "salesops") return "SalesOPS";
  if (/^squad\s*\d+$/.test(normalized)) {
    const num = normalized.match(/\d+/)[0];
    return `Squad ${num}`;
  }
  if (/^key\s*accounts?\s*\d+$/.test(normalized)) {
    const num = normalized.match(/\d+/)[0];
    return `Key Accounts ${num}`;
  }
  if (normalized.includes("capacita")) return "Capacitação e Desenvolvimento";
  return null;
}

function buildRowFormulas(row, campanha, email, disparos) {
  return [
    `=INDEX(unfinished!$A:$A; MATCH(B${row}; unfinished!$B:$B; 0))`,
    campanha,
    email,
    `=INDEX(unfinished!$D:$D; MATCH(B${row}; unfinished!$B:$B; 0))`,
    disparos,
    `=INDEX(unfinished!$C:$C; MATCH(B${row}; unfinished!$B:$B; 0))`,
    `=(F${row}/E${row})`,
    `=IF(D${row}<>"";WORKDAY.INTL(TODAY()-1;G${row});)`,
  ];
}

async function processAdicionar(sheets) {
  const res = await sheetsRead(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId: PLANILHA_ATUALIZACAO,
      range: "Adicionar",
    })
  );

  const rows = res.data.values || [];
  if (rows.length <= 1) {
    console.log("  Nenhuma entrada na aba Adicionar");
    return;
  }

  const entries = rows.slice(1).filter((r) => r.length >= 5 && r[0]);
  if (entries.length === 0) {
    console.log("  Nenhuma entrada válida na aba Adicionar");
    return;
  }

  const byTab = {};
  const unmapped = [];

  for (const row of entries) {
    const campanha = row[0];
    const email = (row[2] || "").trim();
    const disparos = parseInt(row[3]) || 0;
    const squad = row[4];
    const tab = mapSquadToTab(squad);

    if (!tab) {
      unmapped.push({ campanha, squad });
      continue;
    }

    if (!byTab[tab]) byTab[tab] = [];
    byTab[tab].push({ campanha, email, disparos });
  }

  if (unmapped.length > 0) {
    console.warn("  ⚠ Squads não mapeados:");
    unmapped.forEach((u) => console.warn(`    "${u.squad}" → ${u.campanha}`));
  }

  const tabNames = Object.keys(byTab);
  if (tabNames.length === 0) {
    console.log("  Nenhuma entrada com squad válido");
    return;
  }

  for (const tab of tabNames) {
    const tabEntries = byTab[tab];

    const colA = await sheetsRead(() =>
      sheets.spreadsheets.values.get({
        spreadsheetId: PLANILHA_RELATORIOS,
        range: `'${tab}'!B:B`,
      })
    );

    const lastRow = colA.data.values ? colA.data.values.length : 1;
    let nextRow = lastRow + 1;

    const batchData = tabEntries.map((entry) => {
      const row = nextRow++;
      return {
        range: `'${tab}'!A${row}:H${row}`,
        values: [buildRowFormulas(row, entry.campanha, entry.email, entry.disparos)],
      };
    });

    await sheetsWrite(() =>
      sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: PLANILHA_RELATORIOS,
        resource: {
          valueInputOption: "USER_ENTERED",
          data: batchData,
        },
      })
    );

    console.log(`  ✔ ${tab}: ${tabEntries.length} campanha(s) adicionada(s)`);
  }

  await sheetsWrite(() =>
    sheets.spreadsheets.values.clear({
      spreadsheetId: PLANILHA_ATUALIZACAO,
      range: "Adicionar!A2:Z",
    })
  );
  console.log("  ✔ Aba Adicionar limpa após processamento");
}

async function processRetirar(sheets) {
  const res = await sheetsRead(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId: PLANILHA_ATUALIZACAO,
      range: "Retirar",
    })
  );

  const rows = res.data.values || [];
  if (rows.length <= 1) {
    console.log("  Nenhuma entrada na aba Retirar");
    return;
  }

  const entries = rows.slice(1).filter((r) => r.length >= 3 && r[0]);
  if (entries.length === 0) {
    console.log("  Nenhuma entrada válida na aba Retirar");
    return;
  }

  const meta = await sheetsRead(() =>
    sheets.spreadsheets.get({ spreadsheetId: PLANILHA_RELATORIOS })
  );
  const sheetMap = {};
  meta.data.sheets.forEach((s) => {
    sheetMap[s.properties.title] = s.properties.sheetId;
  });

  const byTab = {};
  for (const row of entries) {
    const campanha = row[0];
    const squad = row[3] || row[2];
    const tab = mapSquadToTab(squad);
    if (!tab || !sheetMap[tab]) continue;
    if (!byTab[tab]) byTab[tab] = [];
    byTab[tab].push(campanha);
  }

  for (const tab of Object.keys(byTab)) {
    const campanhasToRemove = byTab[tab];
    const sheetId = sheetMap[tab];

    const tabData = await sheetsRead(() =>
      sheets.spreadsheets.values.get({
        spreadsheetId: PLANILHA_RELATORIOS,
        range: `'${tab}'!B:B`,
      })
    );

    const allNames = tabData.data.values || [];
    const rowsToDelete = [];

    for (const campanha of campanhasToRemove) {
      for (let i = allNames.length - 1; i >= 0; i--) {
        if (allNames[i][0] && allNames[i][0].trim().toLowerCase() === campanha.trim().toLowerCase()) {
          rowsToDelete.push(i);
          break;
        }
      }
    }

    rowsToDelete.sort((a, b) => b - a);

    for (const rowIdx of rowsToDelete) {
      await sheetsWrite(() =>
        sheets.spreadsheets.batchUpdate({
          spreadsheetId: PLANILHA_RELATORIOS,
          resource: {
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId,
                    dimension: "ROWS",
                    startIndex: rowIdx,
                    endIndex: rowIdx + 1,
                  },
                },
              },
            ],
          },
        })
      );
    }

    if (rowsToDelete.length > 0) {
      console.log(`  ✔ ${tab}: ${rowsToDelete.length} campanha(s) removida(s)`);
    }
  }

  if (entries.length > 0) {
    await sheetsWrite(() =>
      sheets.spreadsheets.values.clear({
        spreadsheetId: PLANILHA_ATUALIZACAO,
        range: "Retirar!A2:Z",
      })
    );
    console.log("  ✔ Aba Retirar limpa após processamento");
  }
}

export async function main() {
  const auth = await google.auth.getClient({
    credentials,
    scopes: "https://www.googleapis.com/auth/spreadsheets",
  });

  const sheets = google.sheets({ version: "v4", auth });

  console.log("  Processando aba Adicionar...");
  await processAdicionar(sheets);

  console.log("  Processando aba Retirar...");
  await processRetirar(sheets);
}
