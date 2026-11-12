-- Seed di test per la fase 1
-- Inserisce due agenti fittizi per eseguire lavori di prova.

INSERT OR IGNORE INTO agents (id, owner, wallet_address) VALUES
  ('agent-buyer-001', 'test-owner-a', '0x0000000000000000000000000000000000000001'),
  ('agent-provider-001', 'test-owner-b', '0x0000000000000000000000000000000000000002');
