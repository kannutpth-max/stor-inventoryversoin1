import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  token_uri: string;
}

function toBase64Url(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Cache the access token across invocations (valid ~1 hour) to avoid
// re-minting a JWT + token endpoint call on every single request.
const TOKEN_CACHE = globalThis as unknown as { __gsAccessToken?: { token: string; exp: number } };

// Short-lived cache of sheet reads. Google allows only 60 reads/minute, and
// page loads, retries and concurrent tabs can easily exceed that. Serving
// repeated reads from this cache (invalidated on every write) keeps us inside
// the quota; stale data older than TTL is still served as a fallback when
// Google is rate limiting instead of failing the request.
const SHEET_CACHE = globalThis as unknown as { __gsSheetCache?: Map<string, { rows: Record<string, string>[]; ts: number }> };
const CACHE_TTL_MS = 30_000;

function cacheGet(sheet: string, maxAgeMs: number = CACHE_TTL_MS): Record<string, string>[] | null {
  const cache = (SHEET_CACHE.__gsSheetCache ??= new Map());
  const entry = cache.get(sheet);
  if (entry && Date.now() - entry.ts <= maxAgeMs) return entry.rows;
  return null;
}

function cacheSet(sheet: string, rows: Record<string, string>[]) {
  (SHEET_CACHE.__gsSheetCache ??= new Map()).set(sheet, { rows, ts: Date.now() });
}

function cacheInvalidate(sheet?: string) {
  const cache = SHEET_CACHE.__gsSheetCache;
  if (!cache) return;
  if (sheet) cache.delete(sheet);
  else cache.clear();
}

async function getAccessToken(credentials: ServiceAccountCredentials): Promise<string> {
  const cached = TOKEN_CACHE.__gsAccessToken;
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const header = toBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = toBase64Url(JSON.stringify({
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: credentials.token_uri,
    exp: now + 3600,
    iat: now,
  }));

  const signInput = `${header}.${claim}`;

  // Import the private key
  const pemContent = credentials.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signInput)
  );

  const sig = toBase64Url(String.fromCharCode(...new Uint8Array(signature)));

  const jwt = `${signInput}.${sig}`;

  const tokenResponse = await fetch(credentials.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok) {
    console.error("Token error:", tokenData);
    throw new Error("Failed to authenticate with Google API");
  }
  TOKEN_CACHE.__gsAccessToken = {
    token: tokenData.access_token,
    exp: Date.now() + (Number(tokenData.expires_in) || 3600) * 1000,
  };
  return tokenData.access_token;
}

const ALLOWED_SHEETS = ["products", "categories", "units", "companies", "departments", "stock_in", "stock_out"];
const ALLOWED_ACTIONS = ["read", "readAll", "create", "update", "delete"];
const MAX_CELL_LENGTH = 5000;

function sanitizeCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str = String(value);
  if (str.length > MAX_CELL_LENGTH) str = str.slice(0, MAX_CELL_LENGTH);
  // Prevent CSV/formula injection
  if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;
  return str;
}

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

async function fetchWithRetry(url: string, init: RequestInit, label: string, maxAttempts = 3): Promise<Response> {
  let lastErr = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url, init);
    if (res.ok) return res;
    // Retry on transient errors
    if ([429, 500, 502, 503, 504].includes(res.status) && attempt < maxAttempts) {
      lastErr = await res.text();
      // Honor Google's Retry-After when present; otherwise back off exponentially.
      const retryAfter = Number(res.headers.get("retry-after"));
      const delay =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(8000, retryAfter * 1000)
          : Math.min(4000, 500 * Math.pow(2, attempt - 1));
      console.log(`Retrying ${label} (attempt ${attempt}, status ${res.status}) after ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }
    const err = await res.text();
    console.error(`Failed to ${label}:`, err);
    throw new Error(res.status === 429 ? `Google Sheets rate limit reached for ${label}; please retry in a moment` : `Failed to ${label}`);
  }
  console.error(`Failed to ${label} after ${maxAttempts} attempts:`, lastErr);
  throw new Error(`Google Sheets is busy (rate limited) for ${label}; please retry in a moment`);
}

async function getSheetHeaders(accessToken: string, sheetId: string, sheetName: string): Promise<string[]> {
  const res = await fetchWithRetry(
    `${SHEETS_API}/${sheetId}/values/${encodeURIComponent(sheetName)}!1:1`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    `read headers ${sheetName}`,
  );
  const data = await res.json();
  const rows = data.values || [];
  return rows[0] || [];
}

async function ensureHeaders(accessToken: string, sheetId: string, sheetName: string, requiredKeys: string[]): Promise<string[]> {
  const existing = await getSheetHeaders(accessToken, sheetId, sheetName);
  const missing = requiredKeys.filter((k) => k && !existing.includes(k));
  if (missing.length === 0) return existing;
  const newHeaders = [...existing, ...missing];
  const range = `${sheetName}!1:1`;
  const res = await fetch(
    `${SHEETS_API}/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [newHeaders] }),
    },
  );
  if (!res.ok) {
    const err = await res.text();
    console.error(`Failed to extend headers in ${sheetName}:`, err);
    throw new Error("Failed to extend headers");
  }
  return newHeaders;
}

function parseSheetRows(rows: string[][]): Record<string, string>[] {
  if (!rows || rows.length === 0) return [];
  const headers = rows[0];
  return rows.slice(1).map((row: string[]) => {
    const obj: Record<string, string> = {};
    headers.forEach((h: string, i: number) => {
      obj[h] = row[i] || "";
    });
    return obj;
  });
}

async function getSheetData(accessToken: string, sheetId: string, sheetName: string) {
  const res = await fetchWithRetry(
    `${SHEETS_API}/${sheetId}/values/${encodeURIComponent(sheetName)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    `read sheet ${sheetName}`,
  );
  const data = await res.json();
  return parseSheetRows(data.values || []);
}

// Reads several sheets with a single Google API request (values:batchGet),
// which keeps us well inside Google's per-minute read quota.
function sheetNameFromRange(range: string): string {
  const m = range.match(/^'([^']+)'!/) || range.match(/^([^'!]+)!/);
  return m ? m[1] : "";
}

async function batchGetSheetData(accessToken: string, sheetId: string, sheetNames: string[]) {
  const ranges = sheetNames.map((s) => `${s}!A1:Z100000`);
  const url = `${SHEETS_API}/${sheetId}/values:batchGet?${ranges.map((r) => `ranges=${r}`).join("&")}`;
  const res = await fetchWithRetry(
    url,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    `batch read sheets ${sheetNames.join(",")}`,
  );
  const data = await res.json();
  const valueRanges: { range?: string; values?: string[][] }[] = data.valueRanges || [];

  const result: Record<string, Record<string, string>[]> = {};
  // Match by the sheet name parsed from each returned range (order-preserving fallback below).
  const byName = new Map<string, { range?: string; values?: string[][] }>();
  valueRanges.forEach((vr, i) => {
    const name = sheetNameFromRange(vr.range || "") || sheetNames[i];
    byName.set(name, vr);
  });
  sheetNames.forEach((name) => {
    const vr = byName.get(name) ?? valueRanges[sheetNames.indexOf(name)];
    result[name] = parseSheetRows(vr?.values || []);
  });
  return result;
}

async function appendRow(accessToken: string, sheetId: string, sheetName: string, values: string[]) {
  const res = await fetch(
    `${SHEETS_API}/${sheetId}/values/${encodeURIComponent(sheetName)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [values] }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    console.error(`Failed to append to ${sheetName}:`, err);
    throw new Error("Failed to append row");
  }
  return await res.json();
}

async function updateRow(accessToken: string, sheetId: string, sheetName: string, rowIndex: number, values: string[]) {
  const range = `${sheetName}!A${rowIndex + 2}`;
  const res = await fetch(
    `${SHEETS_API}/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values: [values] }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    console.error(`Failed to update row in ${sheetName}:`, err);
    throw new Error("Failed to update row");
  }
  return await res.json();
}

async function deleteRow(accessToken: string, sheetId: string, sheetName: string, rowIndex: number) {
  // First get the sheet's gid
  const metaRes = await fetch(`${SHEETS_API}/${sheetId}?fields=sheets.properties`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const metaData = await metaRes.json();
  const sheet = metaData.sheets?.find((s: any) => s.properties.title === sheetName);
  if (!sheet) throw new Error(`Sheet ${sheetName} not found`);
  const sheetGid = sheet.properties.sheetId;

  const res = await fetch(`${SHEETS_API}/${sheetId}:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [{
        deleteDimension: {
          range: {
            sheetId: sheetGid,
            dimension: "ROWS",
            startIndex: rowIndex + 1, // +1 for header
            endIndex: rowIndex + 2,
          },
        },
      }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`Failed to delete row from ${sheetName}:`, err);
    throw new Error("Failed to delete row");
  }
  return await res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const credentialsJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_CREDENTIALS");
    if (!credentialsJson) {
      console.error("GOOGLE_SERVICE_ACCOUNT_CREDENTIALS not configured");
      throw new Error("Server configuration error");
    }

    const googleSheetId = Deno.env.get("GOOGLE_SHEET_ID");
    if (!googleSheetId) {
      console.error("GOOGLE_SHEET_ID not configured");
      throw new Error("Server configuration error");
    }

    let credentials: ServiceAccountCredentials;
    try {
      const parsed = JSON.parse(credentialsJson);
      credentials = {
        client_email: parsed.client_email,
        private_key: parsed.private_key,
        token_uri: parsed.token_uri || "https://oauth2.googleapis.com/token",
      };
    } catch {
      console.error("GOOGLE_SERVICE_ACCOUNT_CREDENTIALS is not valid JSON");
      throw new Error("Server configuration error");
    }

    if (!credentials.client_email || !credentials.private_key) {
      console.error("Credentials missing required fields");
      throw new Error("Server configuration error");
    }

    // Normalize private key - ensure proper PEM format with \n
    credentials.private_key = credentials.private_key
      .replace(/\\n/g, '\n')
      .trim();

    const accessToken = await getAccessToken(credentials);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return new Response(JSON.stringify({ success: false, error: "Invalid request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { action, sheet, data, id, sheets } = body as { action?: string; sheet?: string; data?: Record<string, unknown>; id?: string; sheets?: unknown };

    // Validate action and sheet
    if (!action || !ALLOWED_ACTIONS.includes(action)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (action !== "readAll" && (!sheet || !ALLOWED_SHEETS.includes(sheet))) {
      return new Response(JSON.stringify({ success: false, error: "Invalid sheet" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if ((action === "update" || action === "delete") && (!id || typeof id !== "string" || id.length > 200)) {
      return new Response(JSON.stringify({ success: false, error: "Invalid id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if ((action === "create" || action === "update") && (!data || typeof data !== "object")) {
      return new Response(JSON.stringify({ success: false, error: "Invalid data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result;
    switch (action) {
      case "read": {
        const cachedRows = cacheGet(sheet);
        if (cachedRows) {
          result = cachedRows;
          break;
        }
        try {
          result = await getSheetData(accessToken, googleSheetId, sheet);
          cacheSet(sheet, result);
        } catch (e) {
          // When Google is rate limiting, serve slightly stale cached data
          // rather than failing the page.
          const stale = cacheGet(sheet, Infinity);
          if (stale) {
            result = stale;
            break;
          }
          throw e;
        }
        break;
      }
      case "readAll": {
        const requested = Array.isArray(sheets)
          ? [...new Set(sheets.filter((s): s is string => typeof s === "string" && ALLOWED_SHEETS.includes(s)))]
          : [];
        if (requested.length === 0) {
          return new Response(JSON.stringify({ success: false, error: "Invalid sheets" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const cachedAll = requested.map((n) => cacheGet(n));
        if (cachedAll.every((c) => c !== null)) {
          result = Object.fromEntries(requested.map((n, i) => [n, cachedAll[i]!]));
          break;
        }
        try {
          result = await batchGetSheetData(accessToken, googleSheetId, requested.slice(0, 10));
          Object.entries(result).forEach(([name, rows]) => cacheSet(name, rows));
        } catch (e) {
          const staleEntries = requested
            .map((n) => [n, cacheGet(n, Infinity)] as const)
            .filter(([, rows]) => rows !== null);
          if (staleEntries.length === requested.length) {
            result = Object.fromEntries(staleEntries);
            break;
          }
          throw e;
        }
        break;
      }
      case "create": {
        const dataKeys = Object.keys(data!);
        const headers = await ensureHeaders(accessToken, googleSheetId, sheet, dataKeys);
        const values = headers.map((h) => sanitizeCellValue(data![h] ?? ""));
        result = await appendRow(accessToken, googleSheetId, sheet, values);
        cacheInvalidate(sheet);
        break;
      }
      case "update": {
        const allRows = await getSheetData(accessToken, googleSheetId, sheet);
        const rowIndex = allRows.findIndex((r: any) => r.id === id);
        if (rowIndex === -1) {
          return new Response(JSON.stringify({ success: false, error: "Not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const headers = await ensureHeaders(accessToken, googleSheetId, sheet, Object.keys(data!));
        const existing = allRows[rowIndex];
        const values = headers.map((h) => sanitizeCellValue(data![h] ?? existing[h] ?? ""));
        result = await updateRow(accessToken, googleSheetId, sheet, rowIndex, values);
        cacheInvalidate(sheet);
        break;
      }
      case "delete": {
        const allData = await getSheetData(accessToken, googleSheetId, sheet);
        const idx = allData.findIndex((r: any) => r.id === id);
        if (idx === -1) {
          return new Response(JSON.stringify({ success: false, error: "Not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        result = await deleteRow(accessToken, googleSheetId, sheet, idx);
        cacheInvalidate(sheet);
        break;
      }
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Operation failed";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
