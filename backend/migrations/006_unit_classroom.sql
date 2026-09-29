-- Migration 006: Link units to classrooms, add publication timestamp.
BEGIN;
ALTER TABLE units ADD COLUMN IF NOT EXISTS classroom_id VARCHAR(36) REFERENCES classrooms(id);
ALTER TABLE units ADD COLUMN IF NOT EXISTS published_at VARCHAR;
CREATE INDEX IF NOT EXISTS ix_units_classroom_id ON units(classroom_id);
COMMIT;
