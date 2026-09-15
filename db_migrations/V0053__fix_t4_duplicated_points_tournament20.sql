-- Исправление задвоенных очков у игрока T4 (баг гонки запросов при timeout, уже устранён в коде)
UPDATE tournament_players SET points = 3.0 WHERE id = 54 AND tournament_id = 20;
