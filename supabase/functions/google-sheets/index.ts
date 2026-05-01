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

async function getAccessToken(credentials: ServiceAccountCredentials): Promise<string> {
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
    throw new Error(`Token error: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

async function fetchWithRetry(url: string, init: RequestInit, label: string, maxAttempts = 4): Promise<Response> {
  let lastErr = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url, init);
    if (res.ok) return res;
    // Retry on transient errors
    if ([429, 500, 502, 503, 504].includes(res.status) && attempt < maxAttempts) {
      lastErr = await res.text();
      const delay = Math.min(2000, 300 * Math.pow(2, attempt - 1));
      console.log(`Retrying ${label} (attempt ${attempt}, status ${res.status}) after ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }
    const err = await res.text();
    throw new Error(`Failed to ${label}: ${err}`);
  }
  throw new Error(`Failed to ${label} after ${maxAttempts} attempts: ${lastErr}`);
}

async function getSheetData(accessToken: string, sheetId: string, sheetName: string) {
  const res = await fetchWithRetry(
    `${SHEETS_API}/${sheetId}/values/${encodeURIComponent(sheetName)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    `read sheet ${sheetName}`,
  );
  const data = await res.json();
  const rows = data.values || [];
  if (rows.length === 0) return [];
  const headers = rows[0];
  return rows.slice(1).map((row: string[]) => {
    const obj: Record<string, string> = {};
    headers.forEach((h: string, i: number) => {
      obj[h] = row[i] || "";
    });
    return obj;
  });
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
    throw new Error(`Failed to append to ${sheetName}: ${err}`);
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
    throw new Error(`Failed to update row in ${sheetName}: ${err}`);
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
    throw new Error(`Failed to delete row from ${sheetName}: ${err}`);
  }
  return await res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const credentialsJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_CREDENTIALS");
    if (!credentialsJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_CREDENTIALS not configured");

    const googleSheetId = Deno.env.get("GOOGLE_SHEET_ID");
    if (!googleSheetId) throw new Error("GOOGLE_SHEET_ID not configured");

    let credentials: ServiceAccountCredentials;
    try {
      const parsed = JSON.parse(credentialsJson);
      credentials = {
        client_email: parsed.client_email,
        private_key: parsed.private_key,
        token_uri: parsed.token_uri || "https://oauth2.googleapis.com/token",
      };
    } catch {
      throw new Error(
        `GOOGLE_SERVICE_ACCOUNT_CREDENTIALS is not valid JSON. ` +
        `Please paste the ENTIRE content of the downloaded .json key file. ` +
        `Current value starts with: "${credentialsJson.substring(0, 30)}..."`
      );
    }

    if (!credentials.client_email || !credentials.private_key) {
      throw new Error(
        "GOOGLE_SERVICE_ACCOUNT_CREDENTIALS is missing required fields (client_email, private_key)."
      );
    }
    
    // Normalize private key - ensure proper PEM format with \n
    credentials.private_key = credentials.private_key
      .replace(/\\n/g, '\n')  // Replace literal \n with actual newlines
      .trim();
    
    console.log("client_email:", credentials.client_email);
    console.log("private_key length:", credentials.private_key.length);
    console.log("private_key starts:", credentials.private_key.substring(0, 40));
    
    const accessToken = await getAccessToken(credentials);

    const { action, sheet, data, id } = await req.json();

    let result;
    switch (action) {
      case "read": {
        result = await getSheetData(accessToken, googleSheetId, sheet);
        break;
      }
      case "create": {
        const headers = Object.keys(data);
        const values = headers.map((h) => data[h] || "");
        // Verify headers match by reading first
        const existing = await getSheetData(accessToken, googleSheetId, sheet);
        if (existing.length === 0) {
          // Sheet might be empty, just append
        }
        result = await appendRow(accessToken, googleSheetId, sheet, values);
        break;
      }
      case "update": {
        const allRows = await getSheetData(accessToken, googleSheetId, sheet);
        const rowIndex = allRows.findIndex((r: any) => r.id === id);
        if (rowIndex === -1) throw new Error(`Row with id ${id} not found in ${sheet}`);
        const headers = Object.keys(allRows[0]);
        const values = headers.map((h) => data[h] ?? allRows[rowIndex][h] ?? "");
        result = await updateRow(accessToken, googleSheetId, sheet, rowIndex, values);
        break;
      }
      case "delete": {
        const allData = await getSheetData(accessToken, googleSheetId, sheet);
        const idx = allData.findIndex((r: any) => r.id === id);
        if (idx === -1) throw new Error(`Row with id ${id} not found in ${sheet}`);
        result = await deleteRow(accessToken, googleSheetId, sheet, idx);
        break;
      }
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
