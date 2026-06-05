-- Task 8.2: Create tables for Cart Service
-- Run this script against your PostgreSQL database (e.g. via DBeaver / psql)

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- carts
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL,
  created_at TIMESTAMP   NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP   NOT NULL DEFAULT NOW(),
  status     VARCHAR(10) NOT NULL DEFAULT 'OPEN'
             CHECK (status IN ('OPEN', 'ORDERED'))
);

CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts (user_id);

-- ─────────────────────────────────────────────────────────────
-- cart_items
-- product_id  – UUID of the product (FK to product-service, not local)
-- count       – number of items
-- product     – JSONB snapshot of product details (title, price, …)
--               stored for convenience so the cart can render without
--               calling the product service on every request
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cart_items (
  cart_id    UUID    NOT NULL REFERENCES carts (id) ON DELETE CASCADE,
  product_id UUID    NOT NULL,
  count      INTEGER NOT NULL DEFAULT 1 CHECK (count > 0),
  product    JSONB   NOT NULL DEFAULT '{}',
  PRIMARY KEY (cart_id, product_id)
);

-- ─────────────────────────────────────────────────────────────
-- orders  (bonus +20)
-- ─────────────────────────────────────────────────────────────
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
