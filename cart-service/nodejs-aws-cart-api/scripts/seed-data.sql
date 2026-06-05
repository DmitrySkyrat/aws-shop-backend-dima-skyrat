-- Task 8.2: Seed data for Cart Service
-- Run AFTER create-tables.sql

-- ─────────────────────────────────────────────────────────────
-- Sample users (fixed UUIDs so foreign keys are stable)
-- ─────────────────────────────────────────────────────────────
-- user_id_1 = 'a3c1b2d4-e5f6-7890-abcd-ef1234567890'
-- user_id_2 = 'b4d2c3e5-f6a7-8901-bcde-f01234567891'

-- ─────────────────────────────────────────────────────────────
-- Sample carts
-- ─────────────────────────────────────────────────────────────
INSERT INTO carts (id, user_id, status)
VALUES
  ('c0a80101-0000-0000-0000-000000000001',
   'a3c1b2d4-e5f6-7890-abcd-ef1234567890',
   'OPEN'),
  ('c0a80101-0000-0000-0000-000000000002',
   'b4d2c3e5-f6a7-8901-bcde-f01234567891',
   'ORDERED')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Sample cart items  (product UUIDs match the product-service)
-- ─────────────────────────────────────────────────────────────
INSERT INTO cart_items (cart_id, product_id, count, product)
VALUES
  ('c0a80101-0000-0000-0000-000000000001',
   'd2dbe00a-6e14-4dcb-9a35-6ce0c8e46049',
   2,
   '{"id":"d2dbe00a-6e14-4dcb-9a35-6ce0c8e46049","title":"Widget A","description":"A great widget","price":29.99}'),

  ('c0a80101-0000-0000-0000-000000000001',
   'fad4c6d8-0c83-4ae6-b3cd-97d16fcbd63b',
   1,
   '{"id":"fad4c6d8-0c83-4ae6-b3cd-97d16fcbd63b","title":"Gadget B","description":"A useful gadget","price":49.99}'),

  ('c0a80101-0000-0000-0000-000000000002',
   '3e8f4d19-7c24-4b8e-a2f5-1a9b0c7d5e3f',
   3,
   '{"id":"3e8f4d19-7c24-4b8e-a2f5-1a9b0c7d5e3f","title":"Thingamajig C","description":"A cool thingamajig","price":9.99}')
ON CONFLICT (cart_id, product_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Sample orders  (bonus)
-- ─────────────────────────────────────────────────────────────
INSERT INTO orders (id, user_id, cart_id, payment, delivery, comments, status, total)
VALUES
  ('e0a10201-0000-0000-0000-000000000001',
   'b4d2c3e5-f6a7-8901-bcde-f01234567891',
   'c0a80101-0000-0000-0000-000000000002',
   '{}',
   '{"address":"123 Main St","firstName":"Jane","lastName":"Doe","comment":""}',
   '',
   'ORDERED',
   29.97)
ON CONFLICT (id) DO NOTHING;
