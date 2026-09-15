-- Проставляем итоговые места (медали) для завершённого тестового турнира — не сработало из-за бага, уже исправленного в коде
UPDATE tournament_players SET place = 1 WHERE id = 55 AND tournament_id = 20;
UPDATE tournament_players SET place = 2 WHERE id = 57 AND tournament_id = 20;
UPDATE tournament_players SET place = 3 WHERE id = 54 AND tournament_id = 20;
UPDATE tournament_players SET place = 4 WHERE id = 56 AND tournament_id = 20;
UPDATE tournament_players SET place = 5 WHERE id = 58 AND tournament_id = 20;
