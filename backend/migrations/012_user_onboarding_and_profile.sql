-- User profile/onboarding metadata. Additive; no auth or RLS changes.
BEGIN;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS institution_type varchar(50);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS institution_name varchar(200);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS grade_level varchar(100);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at text;
UPDATE public.users SET onboarding_completed=true WHERE id='local-teacher' OR id='local-student' OR email LIKE 'staging-%@lessonfoundry.internal';
COMMIT;
