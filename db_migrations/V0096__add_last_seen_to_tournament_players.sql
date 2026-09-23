-- Присутствие участника в турнирном зале — для индикатора "онлайн" в турнирной таблице.
-- Обновляется при каждом GET-запросе зала авторизованным участником.
ALTER TABLE tournament_players ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP;