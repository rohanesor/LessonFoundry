-- Migration 004: Extend users with email, avatar and role.
-- Safe: all new columns are nullable or have defaults. Existing rows get role='teacher'.
BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR NOT NULL DEFAULT 'teacher';
COMMIT;
