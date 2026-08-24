/**
 * SIMPulse — API Configuration
 * ─────────────────────────────────────────────────
 * Replace API_URL with your actual backend endpoint.
 * The fetchDashboardData() function returns a Promise
 * that resolves to the API JSON array.
 *
 * Expected shape per destination object:
 * {
 *   destination          : string,
 *   current_orders       : number,
 *   current_revenue      : number,
 *   prev_orders          : number,
 *   prev_revenue         : number,
 *   order_growth_pct     : number,
 *   revenue_growth_pct   : number,
 *   arpu                 : number,
 *   market_share_pct     : number,
 *   opportunity_category : "INVEST" | "MAINTAIN" | "EXPLORE" | "FIX",
 *   revenue_order_relation: { orders: number, revenue: number }
 * }
 */

// ── Configuration ──────────────────────────────────
const SUPABASE_BASE_URL = typeof window !== "undefined" && window.SUPABASE_URL
  ? window.SUPABASE_URL
  : "https://pmfiamiebikefcraahjd.supabase.co";

const CLIENT_ANON_KEY = typeof window !== "undefined" && window.SUPABASE_ANON_KEY
  ? window.SUPABASE_ANON_KEY
  : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtZmlhbWllYmlrZWZjcmFhaGpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2ODgyNDAsImV4cCI6MjA5NzI2NDI0MH0.Z9XCGCz9-_fuIFocdqUXauLrgsNo91ZNrMLIBGpI7EA";

const API_URL = `${SUPABASE_BASE_URL}/rest/v1/rpc/destination_insights`;
const API_TIMEOUT_MS = 15000;                  // 15-second request timeout

/**
 * Fetch dashboard data from the configured API endpoint.
 * Returns a promise that resolves to an array of destination records.
 *
 * @param {string} [reportDate="2026-05-20"] - Reporting date formatted as YYYY-MM-DD
 * @returns {Promise<Array>}
 */
async function fetchDashboardData(reportDate = "2026-05-20") {
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    // Get active session token if available, fallback to client anon key
    let authToken = CLIENT_ANON_KEY;
    if (typeof SIMPulseAuth !== "undefined") {
      const session = await SIMPulseAuth.getSession();
      if (session && session.access_token) {
        authToken = session.access_token;
      }
    }

    const response = await fetch(API_URL, {
      method: "POST",

      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",

        "apikey": CLIENT_ANON_KEY,
        "Authorization": `Bearer ${authToken}`
      },

      body: JSON.stringify({
        report_date: reportDate
      }),

      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("Unexpected API response format — expected an array.");
    }

    return data;

  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === "AbortError") {
      throw new Error("Request timed out. Please check your API endpoint and network.");
    }

    throw err;
  }
}

/**
 * Utility — format a number as currency (USD).
 * @param {number} value
 * @returns {string}
 */
function formatCurrency(value) {
  if (value === null || value === undefined || isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style                : "currency",
    currency             : "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Utility — format a number with thousands separators.
 * @param {number} value
 * @returns {string}
 */
function formatNumber(value) {
  if (value === null || value === undefined || isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US").format(value);
}

/**
 * Utility — format a percentage value.
 * @param {number} value
 * @param {number} [decimals=2]
 * @returns {string}
 */
function formatPercent(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Utility — format ARPU value.
 * @param {number} value
 * @returns {string}
 */
function formatARPU(value) {
  if (value === null || value === undefined || isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style                : "currency",
    currency             : "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
