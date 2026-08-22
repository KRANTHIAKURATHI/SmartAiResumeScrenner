-- Lock the browser out of jobs, candidates, applications and resume files.
-- All reads and writes now go through trusted server functions.

DROP POLICY IF EXISTS "Public access to jobs" ON public.jobs;
DROP POLICY IF EXISTS "Public access to candidates" ON public.candidates;
DROP POLICY IF EXISTS "Public access to applications" ON public.applications;

REVOKE ALL ON public.jobs FROM anon, authenticated;
REVOKE ALL ON public.candidates FROM anon, authenticated;
REVOKE ALL ON public.applications FROM anon, authenticated;

GRANT ALL ON public.jobs TO service_role;
GRANT ALL ON public.candidates TO service_role;
GRANT ALL ON public.applications TO service_role;

ALTER TABLE public.jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.candidates FORCE ROW LEVEL SECURITY;
ALTER TABLE public.applications FORCE ROW LEVEL SECURITY;

-- Stop broadcasting application changes (scores, notes) to every subscriber.
ALTER PUBLICATION supabase_realtime DROP TABLE public.applications;

-- Private resume bucket: no blanket public object access. Uploads use
-- server-issued one-time signed upload URLs; reads use signed URLs.
DROP POLICY IF EXISTS "Public resume read" ON storage.objects;
DROP POLICY IF EXISTS "Public resume insert" ON storage.objects;
DROP POLICY IF EXISTS "Public resume update" ON storage.objects;
DROP POLICY IF EXISTS "Public resume delete" ON storage.objects;