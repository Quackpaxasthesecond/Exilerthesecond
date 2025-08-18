-- Migration: create hi_shop_inventory and indexes
CREATE TABLE IF NOT EXISTS hi_shop_inventory (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  item TEXT NOT NULL,
  metadata JSONB,
  expires BIGINT,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hi_shop_user ON hi_shop_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_hi_shop_expires ON hi_shop_inventory(expires);
