-- Migration 009: metadata for approved PDF exports. Additive; no RLS changes.
BEGIN;
ALTER TABLE public.exports ADD COLUMN IF NOT EXISTS requested_by VARCHAR(36) REFERENCES public.users(id);
ALTER TABLE public.exports ADD COLUMN IF NOT EXISTS file_size INTEGER;
ALTER TABLE public.exports ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf';
ALTER TABLE public.exports ALTER COLUMN status SET DEFAULT 'queued';
CREATE INDEX IF NOT EXISTS ix_exports_unit_status ON public.exports(unit_id, status);
COMMIT;
