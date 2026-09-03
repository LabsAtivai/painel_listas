/**
 * snovioRateLimiter.js
 *
 * O Snov.io limita a 60 requisições/minuto (aparentemente por IP de origem, não por
 * client_id/secret — contas diferentes disparam o mesmo bloqueio). Os scripts de
 * sincronização faziam N chamadas em sequência sem nenhum espaçamento (ex: uma conta
 * com 30+ campanhas dispara 30+ chamadas de progresso de uma vez), estourando o limite
 * e derrubando o resto da execução com 429 sem retry.
 *
 * Uso:
 *   import { snovio } from '../services/snovioRateLimiter.js';
 *   const res = await snovio(() => axios.get(...));
 */

const REQUESTS_PER_MINUTE = 55; // margem de segurança abaixo de 60
const INTERVAL_MS = 60_000;

function createLimiter() {
  let count = 0;
  let windowStart = Date.now();

  return async function execute(fn) {
    const now = Date.now();

    if (now - windowStart >= INTERVAL_MS) {
      count = 0;
      windowStart = now;
    }

    if (count >= REQUESTS_PER_MINUTE) {
      const waitMs = INTERVAL_MS - (now - windowStart) + 100;
      console.log(`⏳ Rate limit do Snov.io atingido. Aguardando ${Math.ceil(waitMs / 1000)}s...`);
      await new Promise((r) => setTimeout(r, waitMs));
      count = 0;
      windowStart = Date.now();
    }

    count++;

    let attempt = 0;
    while (true) {
      try {
        return await fn();
      } catch (err) {
        const status = err?.response?.status;
        if (status === 429 && attempt < 5) {
          attempt++;
          const backoff = Math.pow(2, attempt) * 1000 + Math.random() * 500;
          console.warn(`⚠ Snov.io retornou 429. Tentativa ${attempt}/5 em ${Math.ceil(backoff / 1000)}s...`);
          await new Promise((r) => setTimeout(r, backoff));
        } else {
          throw err;
        }
      }
    }
  };
}

export const snovio = createLimiter();
