-- 1. Roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('recruiter', 'candidate');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Backfill: existing accounts are recruiters
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'recruiter'::public.app_role FROM public.profiles p
ON CONFLICT (user_id, role) DO NOTHING;

-- 2. Signup trigger assigns profile role + role row
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested text := COALESCE(NEW.raw_user_meta_data->>'role', 'recruiter');
  resolved public.app_role;
BEGIN
  resolved := CASE WHEN requested = 'candidate' THEN 'candidate' ELSE 'recruiter' END::public.app_role;

  INSERT INTO public.profiles (user_id, full_name, email, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email, resolved::text)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, resolved)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 3. Candidate ownership columns
ALTER TABLE public.candidates ADD COLUMN IF NOT EXISTS candidate_user_id uuid;
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS candidate_user_id uuid;
CREATE INDEX IF NOT EXISTS candidates_candidate_user_id_idx ON public.candidates (candidate_user_id);
CREATE INDEX IF NOT EXISTS applications_candidate_user_id_idx ON public.applications (candidate_user_id);

-- Helper: which recruiter owns a job
CREATE OR REPLACE FUNCTION public.job_owner(_job_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.jobs WHERE id = _job_id;
$$;

REVOKE ALL ON FUNCTION public.job_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.job_owner(uuid) TO authenticated, service_role;

-- 4. Candidate-facing policies
DROP POLICY IF EXISTS "Candidates view active jobs" ON public.jobs;
CREATE POLICY "Candidates view active jobs" ON public.jobs
  FOR SELECT TO authenticated
  USING (status = 'active' AND public.has_role(auth.uid(), 'candidate'));

DROP POLICY IF EXISTS "Candidates read own candidate records" ON public.candidates;
CREATE POLICY "Candidates read own candidate records" ON public.candidates
  FOR SELECT TO authenticated
  USING (candidate_user_id = auth.uid());

DROP POLICY IF EXISTS "Candidates create own candidate records" ON public.candidates;
CREATE POLICY "Candidates create own candidate records" ON public.candidates
  FOR INSERT TO authenticated
  WITH CHECK (candidate_user_id = auth.uid() AND public.has_role(auth.uid(), 'candidate'));

DROP POLICY IF EXISTS "Candidates read own applications" ON public.applications;
CREATE POLICY "Candidates read own applications" ON public.applications
  FOR SELECT TO authenticated
  USING (candidate_user_id = auth.uid());

DROP POLICY IF EXISTS "Candidates create own applications" ON public.applications;
CREATE POLICY "Candidates create own applications" ON public.applications
  FOR INSERT TO authenticated
  WITH CHECK (
    candidate_user_id = auth.uid()
    AND public.has_role(auth.uid(), 'candidate')
    AND user_id = public.job_owner(job_id)
  );