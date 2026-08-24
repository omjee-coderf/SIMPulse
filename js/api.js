/**
 * SIMPulse — API Integration Layer (api.js)
 * ─────────────────────────────────────────────────
 * Single RPC endpoint: dashboard_summary
 * Supabase project: pmfiamiebikefcraahjd.supabase.co
 *
 * Expected response:
 * {
 *   "kpi":      { today_sales, today_revenue, mtd_sales, mtd_revenue, pm_sales, pm_revenue },
 *   "daily":    [ { order_date, daily_sales, daily_revenue } ],
 *   "monthly":  [ { order_month, monthly_sales, monthly_revenue } ],
 *   "employee": [ { staff_name, td_sales, td_revenue, mtd_sales, mtd_revenue } ]
 * }
 */

// ── Configuration ──────────────────────────────────
// NOTE: SUPABASE_URL and SUPABASE_ANON_KEY are already declared as top-level
// `const` in js/auth.js, which loads before this file. Classic <script> tags
// on the same page share one global scope, so redeclaring them here throws
// "Identifier 'SUPABASE_URL' has already been declared" — a SyntaxError that
// aborts this entire script before fetchDashboardData() is ever defined.
// Reuse the ones auth.js already created instead of redeclaring them.

// ─── Single confirmed RPC endpoint ───────────────────────────────────────────
const API_ENDPOINT = `${SUPABASE_URL}/rest/v1/rpc/dashboard_summary`;

const API_TIMEOUT_MS = 15000;

/**
 * Fetch dashboard data from the real Supabase RPC function: dashboard_summary.
 * @param {string} reportDate - Date string from the date picker
 * @returns {Promise<Object>} Normalized { kpi, daily, monthly, employee }
 */
async function fetchDashboardData(reportDate) {

  // 1. Normalize date to YYYY-MM-DD for PostgreSQL
  const isoDate = toISODate(reportDate);

  // 2. Resolve auth token
  let authToken = SUPABASE_ANON_KEY;
  if (typeof SIMPulseAuth !== "undefined" && SIMPulseAuth.getSession) {
    try {
      const session = await SIMPulseAuth.getSession();
      if (session && session.access_token) {
        authToken = session.access_token;
      }
    } catch (_) { /* use anon key */ }
  }

  // 3. Build and send the request
  const controller  = new AbortController();
  const timeoutId   = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  const requestBody = { report_date: isoDate };

  console.group("[SIMPulse API] dashboard_summary");
  console.log("Endpoint   :", API_ENDPOINT);
  console.log("Report date:", isoDate);
  console.log("Body       :", JSON.stringify(requestBody));

  let response;
  try {
    response = await fetch(API_ENDPOINT, {
      method : "POST",
      headers: {
        "Content-Type" : "application/json",
        "Accept"       : "application/json",
        "apikey"       : SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${authToken}`
      },
      body  : JSON.stringify(requestBody),
      signal: controller.signal
    });
  } catch (networkErr) {
    clearTimeout(timeoutId);
    console.error("Network error:", networkErr);
    console.groupEnd();
    if (networkErr.name === "AbortError") {
      throw new Error("Request timed out. The API server did not respond.");
    }
    throw new Error(`Network error: ${networkErr.message}`);
  }

  clearTimeout(timeoutId);
  console.log("HTTP status:", response.status, response.statusText);

  // 4. Handle HTTP errors
  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    console.error("Error response body:", errBody);
    console.groupEnd();
    throw new Error(
      `API error (${response.status} ${response.statusText})` +
      (errBody ? `\n${errBody}` : "")
    );
  }

  // 5. Parse JSON
  let rawData;
  try {
    rawData = await response.json();
  } catch (parseErr) {
    console.error("JSON parse error:", parseErr);
    console.groupEnd();
    throw new Error("API returned a response that is not valid JSON.");
  }

  // DEBUG — full raw response visible in DevTools Console → tab
  console.log("Raw response type:", Array.isArray(rawData) ? "array[" + rawData.length + "]" : typeof rawData);
  console.log("Raw response (full):", JSON.stringify(rawData, null, 2));
  console.groupEnd();

  // 6. Normalize response shape
  const normalized = normalizeApiResponse(rawData);

  if (!normalized) {
    throw new Error(
      "API response shape is not recognized.\n" +
      "Expected: { kpi:{...}, daily:[...], monthly:[...], employee:[...] }\n" +
      "Received: " + JSON.stringify(rawData, null, 2).slice(0, 500)
    );
  }

  // 7. Validate required fields
  validateApiResponse(normalized);

  return normalized;
}

/**
 * Convert any date string to YYYY-MM-DD for PostgreSQL.
 * @param {string} input
 * @returns {string} YYYY-MM-DD
 */
function toISODate(input) {
  if (!input) return new Date().toISOString().split("T")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  // DD-MM-YYYY
  const ddmm = input.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (ddmm) return `${ddmm[3]}-${ddmm[2]}-${ddmm[1]}`;
  // MM/DD/YYYY
  const mmdd = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (mmdd) return `${mmdd[3]}-${mmdd[1]}-${mmdd[2]}`;
  const d = new Date(input);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  console.warn("[SIMPulse] Unrecognized date format:", input);
  return input;
}

/**
 * Convert any date string to YYYY-MM-DD for PostgreSQL.
 * Handles YYYY-MM-DD, DD-MM-YYYY, MM/DD/YYYY.
 * @param {string} input
 * @returns {string} YYYY-MM-DD
 */
function toISODate(input) {
  if (!input) return new Date().toISOString().split("T")[0];

  // Already correct
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;

  // DD-MM-YYYY
  const ddmmyyyy = input.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;

  // MM/DD/YYYY
  const mmddyyyy = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (mmddyyyy) return `${mmddyyyy[3]}-${mmddyyyy[1]}-${mmddyyyy[2]}`;

  // Browser parse fallback
  const d = new Date(input);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];

  console.warn("[SIMPulse] Unrecognized date format:", input);
  return input;
}

/**
 * Normalize the raw API response into the expected PRD schema.
 * Handles: direct object, single-element array, wrapper key, JSON string.
 * @param {any} raw
 * @returns {{ kpi, daily, monthly, employee } | null}
 */
function normalizeApiResponse(raw) {
  if (raw === null || raw === undefined) return null;

  let data = raw;

  // Unwrap JSON string
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch (_) { return null; }
  }

  // Unwrap single-element array
  if (Array.isArray(data)) {
    if (data.length === 0) return null;
    if (data.length === 1 && data[0] && typeof data[0] === "object") {
      data = data[0];
    } else {
      return null;
    }
  }

  if (!data || typeof data !== "object") return null;

  // Unwrap wrapper key (e.g. { dashboard_summary: { kpi, ... } })
  if (!data.kpi && !data.daily && !data.monthly && !data.employee) {
    const keys = Object.keys(data);
    if (keys.length === 1) {
      const inner = data[keys[0]];
      if (inner && typeof inner === "object" &&
          (inner.kpi || inner.daily || inner.monthly || inner.employee)) {
        data = inner;
      }
    }
  }

  return {
    kpi     : (data.kpi && typeof data.kpi === "object") ? data.kpi : null,
    daily   : Array.isArray(data.daily)    ? data.daily    : [],
    monthly : Array.isArray(data.monthly)  ? data.monthly  : [],
    employee: Array.isArray(data.employee) ? data.employee : []
  };
}

/**
 * Validate normalized response — throw descriptive errors.
 * @param {{ kpi, daily, monthly, employee }} data
 */
function validateApiResponse(data) {
  if (!data || typeof data !== "object") {
    throw new Error("API returned an empty or invalid response.");
  }

  if (!data.kpi || typeof data.kpi !== "object") {
    throw new Error(
      "API response is missing the 'kpi' object.\n" +
      "Top-level keys received: " + Object.keys(data || {}).join(", ")
    );
  }

  const kpiFields = ["today_sales", "today_revenue", "mtd_sales", "mtd_revenue", "pm_sales", "pm_revenue"];
  const missing   = kpiFields.filter(k => data.kpi[k] === undefined);
  if (missing.length) {
    console.warn("[SIMPulse API] KPI fields absent:", missing, "| Available:", Object.keys(data.kpi));
  }

  if (!Array.isArray(data.daily)) {
    throw new Error("API response is missing 'daily' array.");
  }
  if (!Array.isArray(data.monthly)) {
    throw new Error("API response is missing 'monthly' array.");
  }
  if (!Array.isArray(data.employee)) {
    throw new Error("API response is missing 'employee' array.");
  }
}

// ── Formatting Utilities ─────────────────────────────

/**
 * Format as Indian Rupees.
 * @param {number} value
 * @param {boolean} [compact=false]
 */
function formatCurrency(value, compact = false) {
  if (value === null || value === undefined || isNaN(value)) return "—";
  if (compact) {
    if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)}Cr`;
    if (value >= 100_000)    return `₹${(value / 100_000).toFixed(2)}L`;
    if (value >= 1_000)      return `₹${(value / 1_000).toFixed(1)}k`;
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0
  }).format(value);
}

/**
 * Format with Indian comma grouping.
 * @param {number} value
 */
function formatNumber(value) {
  if (value === null || value === undefined || isNaN(value)) return "—";
  return new Intl.NumberFormat("en-IN").format(value);
}

/**
 * Format percentage with + prefix.
 * @param {number} value
 * @param {number} [decimals=1]
 */
function formatPercent(value, decimals = 1) {
  if (value === null || value === undefined || isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}


