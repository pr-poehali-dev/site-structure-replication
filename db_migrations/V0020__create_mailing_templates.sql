CREATE TABLE IF NOT EXISTS t_p58220589_site_structure_repli.mailing_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    html_body TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);