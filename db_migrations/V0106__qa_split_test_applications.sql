INSERT INTO applications (tournament_id, tournament_title, fio, status, fsr_id)
SELECT 31, 'QA Split Test', 'QA Participant ' || fsr_id, 'paid', fsr_id
FROM t_p58220589_site_structure_repli.fsr_official_cache
WHERE fsr_id IN ('123698', '0377', '15723', '0096', '0052');