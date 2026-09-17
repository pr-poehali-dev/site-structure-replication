UPDATE tournaments SET hall_status='active', status='closed' WHERE id=24;

INSERT INTO tournament_rounds (tournament_id, round_number, status, started_at)
VALUES (24, 1, 'active', now());
