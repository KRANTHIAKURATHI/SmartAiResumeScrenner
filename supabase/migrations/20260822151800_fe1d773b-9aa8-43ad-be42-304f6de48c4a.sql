-- profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  full_name TEXT,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'recruiter',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own profile" ON public.profiles FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- jobs
CREATE TABLE public.jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  department TEXT,
  location TEXT,
  employment_type TEXT,
  description TEXT NOT NULL DEFAULT '',
  minimum_experience NUMERIC NOT NULL DEFAULT 0,
  required_skills TEXT[] NOT NULL DEFAULT '{}',
  preferred_skills TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recruiters manage own jobs" ON public.jobs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX jobs_user_id_created_at_idx ON public.jobs (user_id, created_at DESC);
CREATE INDEX jobs_status_idx ON public.jobs (user_id, status);

-- candidates
CREATE TABLE public.candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Unknown candidate',
  email TEXT,
  phone TEXT,
  location TEXT,
  "current_role" TEXT,
  current_company TEXT,
  years_experience NUMERIC,
  skills TEXT[] NOT NULL DEFAULT '{}',
  education JSONB NOT NULL DEFAULT '[]'::jsonb,
  certifications JSONB NOT NULL DEFAULT '[]'::jsonb,
  experience JSONB NOT NULL DEFAULT '[]'::jsonb,
  parsed_resume TEXT,
  resume_path TEXT,
  resume_filename TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidates TO authenticated;
GRANT ALL ON public.candidates TO service_role;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recruiters manage own candidates" ON public.candidates FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX candidates_user_id_created_at_idx ON public.candidates (user_id, created_at DESC);
CREATE UNIQUE INDEX candidates_user_email_key ON public.candidates (user_id, lower(email)) WHERE email IS NOT NULL;

-- applications
CREATE TABLE public.applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  match_score NUMERIC,
  match_label TEXT,
  match_summary TEXT,
  matching_skills TEXT[] NOT NULL DEFAULT '{}',
  missing_skills TEXT[] NOT NULL DEFAULT '{}',
  experience_analysis TEXT,
  education_analysis TEXT,
  requirement_coverage JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'uploaded',
  error_message TEXT,
  recruiter_notes TEXT,
  source_filename TEXT,
  screened_at TIMESTAMPTZ,
  shortlisted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, candidate_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Recruiters manage own applications" ON public.applications FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX applications_user_id_idx ON public.applications (user_id, created_at DESC);
CREATE INDEX applications_job_id_score_idx ON public.applications (job_id, match_score DESC NULLS LAST);
CREATE INDEX applications_candidate_id_idx ON public.applications (candidate_id);
CREATE INDEX applications_status_idx ON public.applications (user_id, status);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER jobs_set_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER candidates_set_updated_at BEFORE UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER applications_set_updated_at BEFORE UPDATE ON public.applications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- auto profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- realtime for live screening status
ALTER TABLE public.applications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.applications;

-- storage policies for private resumes bucket
CREATE POLICY "Recruiters read own resumes" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Recruiters upload own resumes" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Recruiters update own resumes" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Recruiters delete own resumes" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);