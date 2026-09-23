-- Присутствие игроков в партии — для индикатора "соперник на связи" на странице партии.
-- Обновляется при каждом GET-запросе партии соответствующим игроком (белым/чёрным).
ALTER TABLE tournament_games ADD COLUMN IF NOT EXISTS white_present_at TIMESTAMP;
ALTER TABLE tournament_games ADD COLUMN IF NOT EXISTS black_present_at TIMESTAMP;