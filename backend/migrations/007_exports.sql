-- Migration 007: Export tracking for downloadable PDFs.
BEGIN;
CREATE TABLE IF NOT EXISTS exports (
    id           VARCHAR(36) NOT NULL PRIMARY KEY,
    unit_id      VARCHAR(36) NOT NULL REFERENCES units(id),
    revision     INTEGER NOT NULL,
    storage_key  VARCHAR,
    status       VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at   VARCHAR NOT NULL,
    completed_at VARCHAR,
    error        TEXT
);
CREATE INDEX IF NOT EXISTS ix_exports_unit ON exports(unit_id);
COMMIT;
