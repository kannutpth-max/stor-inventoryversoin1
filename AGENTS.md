# Google Sheets edge function reliability

- The `google-sheets` edge function serves reads from its in-memory cache (stale-while-revalidate) and only calls Google when no cached copy exists; it must never return a 429 error while any cached or freshly fetched data can be served — stale data beats a hard error. Why: Google allows only 60 reads/minute, which repeated page loads easily exhaust.
- Sheet-read cache is mirrored in the `public.sheets_cache` table (service-role only) so it survives edge-function instance restarts; writes invalidate both the in-memory and the DB copy, and the frontend keeps a last-good copy in localStorage as a final fallback.
