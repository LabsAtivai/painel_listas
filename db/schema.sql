-- Schema do painel_listas — substitui o Google Sheets como fonte de dados operacional.
--
-- Segredos (client_id/client_secret/senha Snov.io) continuam SOMENTE no sistema de
-- credenciais (snov-am-api / projeto "credenciais"). Este banco não duplica segredo —
-- guarda só o que é necessário pra listar campanhas e montar as listas por squad sem
-- precisar chamar a API do Snov.io toda hora.
--
-- Rode isso no banco de produção antes de eu ligar o app nele.

CREATE TABLE IF NOT EXISTS contas_snovio (
  id               CHAR(36)      NOT NULL,               -- mesmo id da conta no sistema de credenciais
  email            VARCHAR(255)  NOT NULL,                -- e-mail da conta interna (accounts.email)
  conta_snovio     VARCHAR(255)  NOT NULL,                -- e-mail de login do Snov.io (emailSnovio)
  status           ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  sincronizado_em  DATETIME      NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_contas_snovio_conta_snovio (conta_snovio),
  KEY idx_contas_snovio_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS campanhas (
  id                BIGINT UNSIGNED NOT NULL,             -- id da campanha no Snov.io
  conta_id          CHAR(36)        NOT NULL,
  nome              VARCHAR(500)    NOT NULL,
  list_id           BIGINT UNSIGNED NULL,
  status_snovio     VARCHAR(50)     NULL,                 -- Active/Archived/Completed/... (valor cru do Snov.io)
  ativos_restantes  INT UNSIGNED    NULL,                 -- último valor conhecido (get-campaign-progress)
  sincronizado_em   DATETIME        NOT NULL,
  PRIMARY KEY (id),
  KEY idx_campanhas_conta (conta_id),
  KEY idx_campanhas_nome (nome),
  CONSTRAINT fk_campanhas_conta FOREIGN KEY (conta_id) REFERENCES contas_snovio (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Substitui as abas Onboarding/SDR REMOTO/Geral (e as demais abas de squad da planilha
-- de relatórios) e a aba "Adicionar" — uma campanha "adicionada" já nasce aqui, sem etapa
-- de sincronização separada, porque agora ela vem de um formulário estruturado (campanha
-- escolhida em dropdown, não digitada à mão), não mais de planilha compartilhada.
CREATE TABLE IF NOT EXISTS listas_squad (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  campanha_id    BIGINT UNSIGNED NOT NULL,
  squad          VARCHAR(50)     NOT NULL,                -- 'Onboarding' | 'SDR REMOTO' | 'Geral' | ...
  conta_email    VARCHAR(255)    NOT NULL,                -- e-mail do operador (digitado no form)
  disparos       INT UNSIGNED    NOT NULL,                -- disparos/dia configurado pro cálculo de prazo
  status         ENUM('ativa','pausada') NOT NULL DEFAULT 'ativa',
  criado_em      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_listas_squad_campanha_squad (campanha_id, squad),  -- mesma campanha não duplica no squad
  KEY idx_listas_squad_squad (squad),
  CONSTRAINT fk_listas_squad_campanha FOREIGN KEY (campanha_id) REFERENCES campanhas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
