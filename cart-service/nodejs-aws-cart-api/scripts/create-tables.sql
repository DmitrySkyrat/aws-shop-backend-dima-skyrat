CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name     VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  email    VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS carts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL,
  created_at TIMESTAMP   NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP   NOT NULL DEFAULT NOW(),
  status     VARCHAR(10) NOT NULL DEFAULT 'OPEN'
             CHECK (status IN ('OPEN', 'ORDERED'))
);

CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts (user_id);

CREATE TABLE IF NOT EXISTS cart_items (
  cart_id    UUID    NOT NULL REFERENCES carts (id) ON DELETE CASCADE,
  product_id UUID    NOT NULL,
  count      INTEGER NOT NULL DEFAULT 1 CHECK (count > 0),
  product    JSONB   NOT NULL DEFAULT '{}',
  PRIMARY KEY (cart_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID        NOT NULL,
  cart_id  UUID        REFERENCES carts (id),
  payment  JSONB       NOT NULL DEFAULT '{}',
  delivery JSONB       NOT NULL DEFAULT '{}',
  comments TEXT        NOT NULL DEFAULT '',
  status   VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  total    NUMERIC(10, 2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders (user_id);
