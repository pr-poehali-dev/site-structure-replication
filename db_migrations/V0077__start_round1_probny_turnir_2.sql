UPDATE tournaments SET hall_status='active', status='closed' WHERE id=23;

INSERT INTO tournament_rounds (tournament_id, round_number, status, started_at)
VALUES (23, 1, 'active', now())
RETURNING id;
