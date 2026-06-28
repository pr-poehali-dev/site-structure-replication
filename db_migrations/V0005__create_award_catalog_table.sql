CREATE TABLE t_p58220589_site_structure_repli.award_catalog (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    composition TEXT[],
    price NUMERIC(10,2),
    icon TEXT DEFAULT 'award',
    photo_url TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);
