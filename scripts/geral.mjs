import cron from 'node-cron';
import { main as mainCampanhas } from './relatoriocampanha1.mjs';
import { main as mainListas } from './relatorioListasv2.mjs';

export async function main() {

  const agora = new Date();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Iniciando execução - ${agora.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {

    console.log('→ Etapa 1: Atualizando campanhas...');
    await mainCampanhas();
    console.log('✔ Campanhas finalizado\n');

    console.log('Aguardando 15 segundos...');
    await new Promise(r => setTimeout(r, 15000));

    console.log('→ Etapa 2: Verificando ativos...');
    await mainListas();
    console.log('✔ Ativos finalizado');

  } catch (error) {

    console.error('ERRO:', error);

  }

  console.log('Processo finalizado');
}