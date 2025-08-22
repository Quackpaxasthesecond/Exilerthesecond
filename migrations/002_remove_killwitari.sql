-- Migration: remove killwitari permanents and cooldown records
-- Removes any existing 'killwitari' inventory rows and related cooldown entries.
-- Run this against your Postgres database (see README or use the psql command below).

BEGIN;

-- Remove all killwitari purchases so the item is fully gone from inventories
DELETE FROM hi_shop_inventory WHERE item = 'killwitari';

-- Remove any persistent cooldown records for killwitari
DROP TABLE IF EXISTS killwitari_cooldowns;

COMMIT;
