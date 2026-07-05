-- Migration: Add trigram indexes for fast LIKE '%term%' search
-- and stock aggregation indexes for batch queries.
-- Run manually: psql -d simrs -f add_trigram_indexes.sql

-- Enable pg_trgm extension (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Medicines: GIN trigram indexes on searchable columns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicines_name_trgm
    ON medicines USING gin (LOWER(name) gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicines_code_trgm
    ON medicines USING gin (LOWER(code) gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicines_generic_name_trgm
    ON medicines USING gin (LOWER(generic_name) gin_trgm_ops);

-- Inventories: GIN trigram indexes on searchable columns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventories_name_trgm
    ON inventories USING gin (LOWER(name) gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventories_code_trgm
    ON inventories USING gin (LOWER(code) gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventories_brand_trgm
    ON inventories USING gin (LOWER(brand) gin_trgm_ops);

-- Stock aggregation indexes (speeds up batch GROUP BY in resolveMedicineStockBatch / resolveInventoryStockBatch)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_room_medicines_medicine_id
    ON room_medicines (medicine_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_room_inventories_inventory_id
    ON room_inventories (inventory_id);
