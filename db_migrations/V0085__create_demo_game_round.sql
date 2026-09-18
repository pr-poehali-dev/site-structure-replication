INSERT INTO tournament_rounds (tournament_id, round_number, status, started_at)
VALUES (25, 1, 'active', now())
RETURNING id;
