-- Тарифы абонементов (настраиваются в админке)
CREATE TABLE t_p58220589_site_structure_repli.subscription_plans (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    participations INTEGER NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Купленные абонементы (аналог промокодов, но с несколькими использованиями)
CREATE TABLE t_p58220589_site_structure_repli.subscriptions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    plan_id INTEGER REFERENCES t_p58220589_site_structure_repli.subscription_plans(id),
    plan_title VARCHAR(255) NOT NULL,
    total_participations INTEGER NOT NULL,
    used_participations INTEGER NOT NULL DEFAULT 0,
    price NUMERIC(10,2) NOT NULL,
    customer_name VARCHAR(255) NULL,
    customer_email VARCHAR(255) NULL,
    customer_phone VARCHAR(50) NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    status VARCHAR(20) NOT NULL DEFAULT 'pending_payment',
    order_id INTEGER REFERENCES t_p58220589_site_structure_repli.orders(id),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    paid_at TIMESTAMP NULL
);

-- Лог использования абонемента (каждое списание участия на конкретную заявку)
CREATE TABLE t_p58220589_site_structure_repli.subscription_usages (
    id SERIAL PRIMARY KEY,
    subscription_id INTEGER NOT NULL REFERENCES t_p58220589_site_structure_repli.subscriptions(id),
    application_id INTEGER REFERENCES t_p58220589_site_structure_repli.applications(id),
    used_at TIMESTAMP NOT NULL DEFAULT now()
);

ALTER TABLE t_p58220589_site_structure_repli.orders
    ADD COLUMN IF NOT EXISTS subscription_id INTEGER REFERENCES t_p58220589_site_structure_repli.subscriptions(id);

INSERT INTO t_p58220589_site_structure_repli.subscription_plans (title, participations, price, sort_order) VALUES
('5 участий', 5, 1000.00, 1),
('10 участий', 10, 1850.00, 2);
