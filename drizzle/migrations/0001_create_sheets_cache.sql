CREATE TABLE public.sheets_cache (
  sheet_name text PRIMARY KEY,
  rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

-- Only edge functions (service_role) touch this table.
GRANT ALL ON public.sheets_cache TO service_role;

ALTER TABLE public.sheets_cache ENABLE ROW LEVEL SECURITY;
-- No policies: anon/authenticated have no access; service_role bypasses RLS.