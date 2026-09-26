-- Ручное исправление последствий бага гонки данных (переиспользование соединения с БД)
-- в турнире 33 "Онлайн-старт - лига субботы — Группа Б" за 26.09.2026.
-- Баг привёл к: (1) потере части игроков в жеребьёвке туров 6-7, (2) неточному
-- подсчёту очков/побед некоторых игроков из-за гонки при завершении партий.
-- Значения ниже пересчитаны вручную по фактическим результатам всех сыгранных
-- партий (tournament_games), включая корректный бонус 0.5 очка игроку 161 за
-- присоединение после 1-го тура (joined_late).

UPDATE tournament_players SET points = 3.0, buchholz = 13.5, wins = 2, place = 9 WHERE id = 141;
UPDATE tournament_players SET points = 3.0, buchholz = 23.0, wins = 3, place = 4 WHERE id = 142;
UPDATE tournament_players SET points = 4.0, buchholz = 22.0, wins = 4, place = 2 WHERE id = 143;
UPDATE tournament_players SET points = 4.0, buchholz = 18.0, wins = 3, place = 3 WHERE id = 144;
UPDATE tournament_players SET points = 3.0, buchholz = 20.0, wins = 3, place = 6 WHERE id = 145;
UPDATE tournament_players SET points = 3.0, buchholz = 14.0, wins = 2, place = 8 WHERE id = 149;
UPDATE tournament_players SET points = 6.0, buchholz = 18.5, wins = 6, place = 1 WHERE id = 150;
UPDATE tournament_players SET points = 2.0, buchholz = 16.0, wins = 2, place = 10 WHERE id = 153;
UPDATE tournament_players SET points = 3.0, buchholz = 21.0, wins = 3, place = 5 WHERE id = 155;
UPDATE tournament_players SET points = 3.0, buchholz = 15.5, wins = 1, place = 7 WHERE id = 156;
UPDATE tournament_players SET points = 1.5, buchholz = 12.0, wins = 0, place = 11 WHERE id = 161;

UPDATE users SET rating_rapid = 1019 WHERE id = 41;
UPDATE users SET rating_rapid = 1143 WHERE id = 81;
UPDATE users SET rating_rapid = 1198 WHERE id = 64;
UPDATE users SET rating_rapid = 1061 WHERE id = 53;
UPDATE users SET rating_rapid = 1109 WHERE id = 55;
UPDATE users SET rating_rapid = 1088 WHERE id = 59;
UPDATE users SET rating_rapid = 1254 WHERE id = 70;
UPDATE users SET rating_rapid = 993 WHERE id = 67;
UPDATE users SET rating_rapid = 1032 WHERE id = 85;
UPDATE users SET rating_rapid = 1105 WHERE id = 76;
UPDATE users SET rating_rapid = 982 WHERE id = 61;

INSERT INTO rating_history (user_id, tournament_id, tournament_title, rating_type, rating_before, rating_after, delta, points, expected_points, games_count)
VALUES
(41, 33, 'Онлайн-старт - лига субботы — Группа Б', 'rapid', 1000, 1019, 18.54, 3.0, 2.421, 6),
(81, 33, 'Онлайн-старт - лига субботы — Группа Б', 'rapid', 1159, 1143, -15.74, 3.0, 3.492, 6),
(64, 33, 'Онлайн-старт - лига субботы — Группа Б', 'rapid', 1195, 1198, 2.86, 4.0, 3.911, 6),
(53, 33, 'Онлайн-старт - лига субботы — Группа Б', 'rapid', 1000, 1061, 60.83, 4.0, 2.099, 6),
(55, 33, 'Онлайн-старт - лига субботы — Группа Б', 'rapid', 1114, 1109, -4.53, 3.0, 3.142, 6),
(59, 33, 'Онлайн-старт - лига субботы — Группа Б', 'rapid', 1097, 1088, -9.46, 3.0, 3.295, 6),
(70, 33, 'Онлайн-старт - лига субботы — Группа Б', 'rapid', 1185, 1254, 68.65, 6.0, 3.855, 6),
(67, 33, 'Онлайн-старт - лига субботы — Группа Б', 'rapid', 1000, 993, -6.58, 2.0, 2.206, 5),
(85, 33, 'Онлайн-старт - лига субботы — Группа Б', 'rapid', 1000, 1032, 32.21, 3.0, 1.993, 6),
(76, 33, 'Онлайн-старт - лига субботы — Группа Б', 'rapid', 1138, 1105, -32.62, 3.0, 4.02, 7),
(61, 33, 'Онлайн-старт - лига субботы — Группа Б', 'rapid', 1000, 982, -18.16, 1.0, 1.568, 4)
ON CONFLICT (user_id, tournament_id) DO NOTHING;