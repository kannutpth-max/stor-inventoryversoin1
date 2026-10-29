# Google Sheets edge function reliability

- The `google-sheets` edge function serves reads from its in-memory cache (stale-while-revalidate) and only calls Google when no cached copy exists; it must never return a 429 error while any cached or freshly fetched data can be served — stale data beats a hard error. Why: Google allows only 60 reads/minute, which repeated page loads easily exhaust.
