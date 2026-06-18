/**
 * sheetsRateLimiter.js
 *
 * Utilitário para respeitar os limites padrão da Google Sheets API:
 *   - 60 read  requests / minuto / usuário
 *   - 60 write requests / minuto / usuário
 *
 * Uso:
 *   import { sheetsRead, sheetsWrite } from '../services/sheetsRateLimiter.js';
 *   const res = await sheetsRead(() => sheets.spreadsheets.values.get(...));
 *   await sheetsWrite(() => sheets.spreadsheets.values.update(...));
 */

const REQUESTS_PER_MINUTE = 55; // margem de segurança abaixo de 60
const INTERVAL_MS = 60_000;

function createLimiter() {
  let count = 0;
  let windowStart = Date.now();

  async function execute(fn) {
    const now = Date.now();

    if (now - windowStart >= INTERVAL_MS) {
      count = 0;
      windowStart = now;
    }

    if (count >= REQUESTS_PER_MINUTE) {
      const waitMs = INTERVAL_MS - (now - windowStart) + 100;
      console.log(`⏳ Rate limit atingido. Aguardando ${Math.ceil(waitMs / 1000)}s...`);
      await new Promise((r) => setTimeout(r, waitMs));
      count = 0;
      windowStart = Date.now();
    }

    count++;

    // Retry com exponential backoff em caso de 429
    let attempt = 0;
    while (true) {
      try {
        return await fn();
      } catch (err) {
        const status = err?.response?.status ?? err?.code;
        if ((status === 429 || status === 503) && attempt < 5) {
          attempt++;
          const backoff = Math.pow(2, attempt) * 1000 + Math.random() * 500;
          console.warn(`⚠ Sheets retornou ${status}. Tentativa ${attempt}/5 em ${Math.ceil(backoff / 1000)}s...`);
          await new Promise((r) => setTimeout(r, backoff));
        } else {
          throw err;
        }
      }
    }
  }

  return execute;
}

export const sheetsRead  = createLimiter();
export const sheetsWrite = createLimiter();
