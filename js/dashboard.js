/**
 * SIMPulse — Dashboard Controller (dashboard.js)
 * ─────────────────────────────────────────────────
 * Orchestrates data loading, KPI card updates,
 * table rendering, chart rendering, and observations.
 * All display values come from the API response —
 * nothing is hardcoded.
 */

// ── State ──────────────────────────────────────────
let RAW_DATA         = [];   // Full unfiltered API data
let FILTERED_DATA    = [];   // Currently displayed data
let TABLE_SORT_COL   = null; // Currently sorted column key
let TABLE_SORT_DIR   = "asc";// "asc" | "desc"
let TABLE_SEARCH_VAL = "";   // Current search term

// ── DOM References ─────────────────────────────────
const EL = {
  loadingOverlay   : () => document.getElementById("loadingOverlay"),
  errorBanner      : () => document.getElementById("errorBanner"),
  errorText        : () => document.getElementById("errorText"),
  dashboardContent : () => document.getElementById("dashboardContent"),
  lastUpdated      : () => document.getElementById("lastUpdated"),
  filterDestination: () => document.getElementById("filterDestination"),
  filterDateRange  : () => document.getElementById("filterDateRange"),
  searchInput      : () => document.getElementById("tableSearch"),
  tableBody        : () => document.getElementById("destTableBody"),
  tableCount       : () => document.getElementById("tableCount"),
  refreshBtn       : () => document.getElementById("refreshBtn"),
  exportBtn        : () => document.getElementById("exportBtn"),
};

// ── Initialisation ─────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // 1. Guard check — require authenticated user or admin
  const user = await SIMPulseAuth.requireAuth(["user", "admin"]);
  if (!user) return;

  // Render User Profile pill in header
  setupUserHeaderProfile(user);

  // Check for Access Denied flash error message
  checkFlashErrorMessage();

  bindUIEvents();
  loadDashboard();
});

/**
 * Configure User Profile Header Controls
 */
function setupUserHeaderProfile(user) {
  const emailEl = document.getElementById("headerUserEmail");
  const avatarEl = document.getElementById("headerUserAvatar");
  const roleEl = document.getElementById("headerUserRole");
  const adminBtn = document.getElementById("adminPortalBtn");

  if (emailEl && user.email) emailEl.textContent = user.email;
  if (avatarEl && user.email) avatarEl.textContent = user.email.charAt(0).toUpperCase();

  const role = (user.role || "user").toUpperCase();
  if (roleEl) roleEl.textContent = role;

  // Show Admin Portal link button if user has ADMIN role
  if (adminBtn && role === "ADMIN") {
    adminBtn.classList.remove("hidden");
  }
}

/**
 * Display flash error banner if redirected from unauthorized access attempt
 */
function checkFlashErrorMessage() {
  const flashMsg = sessionStorage.getItem("simpulse_flash_error");
  if (flashMsg) {
    sessionStorage.removeItem("simpulse_flash_error");
    showError(flashMsg);
  }
}

/**
 * Wire up all interactive UI controls.
 */
function bindUIEvents() {
  // Logout button
  document.getElementById("logoutBtn")?.addEventListener("click", () => SIMPulseAuth.logout());

  // Refresh button
  EL.refreshBtn()?.addEventListener("click", () => loadDashboard());

  // Destination filter dropdown
  EL.filterDestination()?.addEventListener("change", () => applyFilters());

  // Date range filter
  EL.filterDateRange()?.addEventListener("change", () => applyFilters());

  // Table search
  EL.searchInput()?.addEventListener("input", e => {
    TABLE_SEARCH_VAL = e.target.value.trim().toLowerCase();
    applyFilters();
  });

  // Table column sort — delegated from header row
  document.getElementById("destTableHead")?.addEventListener("click", e => {
    const th = e.target.closest("th[data-col]");
    if (!th) return;
    const col = th.dataset.col;
    if (TABLE_SORT_COL === col) {
      TABLE_SORT_DIR = TABLE_SORT_DIR === "asc" ? "desc" : "asc";
    } else {
      TABLE_SORT_COL = col;
      TABLE_SORT_DIR = "asc";
    }
    renderDestinationTable(FILTERED_DATA);
    updateSortIndicators();
  });

  // CSV Export
  EL.exportBtn()?.addEventListener("click", () => exportTableCSV());
}

// ── Data Loading ───────────────────────────────────
/**
 * Main entry point — fetch data, then render everything.
 */
async function loadDashboard() {
  showLoading(true);
  hideError();

  try {
    RAW_DATA = await fetchDashboardData();

    // Validate we have usable data
    if (!RAW_DATA || RAW_DATA.length === 0) {
      throw new Error("API returned an empty dataset.");
    }

    // Populate destination filter dropdown
    populateDestinationFilter(RAW_DATA);

    // Apply any active filters and render
    applyFilters();

    // Update last-refreshed timestamp
    updateLastUpdated();

    // Show dashboard
    showLoading(false);
    showDashboard(true);

  } catch (err) {
    console.error("[SIMPulse] Data load failed:", err);
    showLoading(false);
    showError(err.message || "Unable to load dashboard data.");
  }
}

/**
 * Apply destination filter + search filter, then re-render.
 */
function applyFilters() {
  const selectedDest  = EL.filterDestination()?.value || "all";

  let filtered = [...RAW_DATA];

  // Destination filter
  if (selectedDest !== "all") {
    filtered = filtered.filter(d => d.destination === selectedDest);
  }

  // Search filter
  if (TABLE_SEARCH_VAL) {
    filtered = filtered.filter(d =>
      d.destination.toLowerCase().includes(TABLE_SEARCH_VAL) ||
      (d.opportunity_category || "").toLowerCase().includes(TABLE_SEARCH_VAL)
    );
  }

  FILTERED_DATA = filtered;

  // Re-render all sections
  updateKPICards(FILTERED_DATA);
  renderDestinationTable(FILTERED_DATA);
  renderRevenueGrowthChart(FILTERED_DATA);
  renderMarketShareChart(FILTERED_DATA);
  renderARPUChart(FILTERED_DATA);
  renderOpportunityMatrix(FILTERED_DATA);
  renderRevenueOrderChart(FILTERED_DATA);
  renderObservations(FILTERED_DATA);
}

// ── KPI Cards ──────────────────────────────────────
/**
 * Update the four executive KPI cards.
 * @param {Array} data
 */
function updateKPICards(data) {
  if (!data || data.length === 0) {
    setKPI("kpiOrders",  "—", "—",  "neutral");
    setKPI("kpiRevenue", "—", "—",  "neutral");
    setKPI("kpiARPU",    "—", "—",  "neutral");
    setKPI("kpiTopDest", "—", "—",  "neutral");
    return;
  }

  // ── Total Orders ──────────────────────────────
  const totalOrders    = data.reduce((s, d) => s + (d.current_orders || 0), 0);
  const prevOrders     = data.reduce((s, d) => s + (d.prev_orders    || 0), 0);
  const orderGrowthPct = prevOrders > 0
    ? ((totalOrders - prevOrders) / prevOrders) * 100
    : 0;

  setKPI(
    "kpiOrders",
    formatNumber(totalOrders),
    `${formatPercent(orderGrowthPct)} vs prev. period`,
    orderGrowthPct >= 0 ? "positive" : "negative"
  );

  // ── Total Revenue ─────────────────────────────
  const totalRevenue   = data.reduce((s, d) => s + (d.current_revenue || 0), 0);
  const prevRevenue    = data.reduce((s, d) => s + (d.prev_revenue    || 0), 0);
  const revenueGrowth  = prevRevenue > 0
    ? ((totalRevenue - prevRevenue) / prevRevenue) * 100
    : 0;

  setKPI(
    "kpiRevenue",
    formatCurrency(totalRevenue),
    `${formatPercent(revenueGrowth)} vs prev. period`,
    revenueGrowth >= 0 ? "positive" : "negative"
  );

  // ── Average ARPU ──────────────────────────────
  const avgARPU = data.reduce((s, d) => s + (d.arpu || 0), 0) / data.length;
  const arpuArr = data.map(d => d.arpu || 0);
  const maxARPU = Math.max(...arpuArr);

  setKPI(
    "kpiARPU",
    formatARPU(avgARPU),
    `Max: ${formatARPU(maxARPU)}`,
    "neutral"
  );

  // ── Top Performing Destination ────────────────
  const topDest = data.reduce((best, d) =>
    (d.current_revenue || 0) > (best.current_revenue || 0) ? d : best,
    data[0]
  );

  const topShare = topDest?.market_share_pct?.toFixed(2);

  setKPI(
    "kpiTopDest",
    topDest?.destination || "—",
    `${topShare}% market share`,
    "neutral"
  );
}

/**
 * Set a KPI card's value, sub-label, and trend class.
 * @param {string} cardId
 * @param {string} value
 * @param {string} sublabel
 * @param {"positive"|"negative"|"neutral"} trend
 */
function setKPI(cardId, value, sublabel, trend) {
  const card = document.getElementById(cardId);
  if (!card) return;

  const valEl      = card.querySelector(".kpi-value");
  const subEl      = card.querySelector(".kpi-sublabel");
  const badgeEl    = card.querySelector(".kpi-badge");

  if (valEl)   valEl.textContent = value;
  if (subEl)   subEl.textContent = sublabel;

  if (badgeEl) {
    badgeEl.className = `kpi-badge kpi-badge--${trend}`;
    const icons = { positive: "▲", negative: "▼", neutral: "●" };
    badgeEl.textContent = icons[trend] || "●";
  }
}

// ── Destination Table ──────────────────────────────
const TABLE_COLUMNS = [
  { key: "destination",        label: "Destination",        type: "string",  align: "left"  },
  { key: "current_orders",     label: "Current Orders",     type: "number",  align: "right" },
  { key: "current_revenue",    label: "Current Revenue",    type: "currency",align: "right" },
  { key: "prev_orders",        label: "Prev. Orders",       type: "number",  align: "right" },
  { key: "prev_revenue",       label: "Prev. Revenue",      type: "currency",align: "right" },
  { key: "order_growth_pct",   label: "Order Growth %",     type: "pct",     align: "right" },
  { key: "revenue_growth_pct", label: "Revenue Growth %",   type: "pct",     align: "right" },
  { key: "arpu",               label: "ARPU",               type: "arpu",    align: "right" },
  { key: "market_share_pct",   label: "Market Share %",     type: "share",   align: "right" },
  { key: "opportunity_category",label: "Opportunity",       type: "badge",   align: "center"},
];

/**
 * Render the destination performance table.
 * Applies current sort before rendering.
 * @param {Array} data
 */
function renderDestinationTable(data) {
  const tbody = EL.tableBody();
  if (!tbody) return;

  // Apply sort
  let sorted = [...data];
  if (TABLE_SORT_COL) {
    sorted.sort((a, b) => {
      const av = a[TABLE_SORT_COL];
      const bv = b[TABLE_SORT_COL];
      if (typeof av === "string") {
        return TABLE_SORT_DIR === "asc"
          ? av.localeCompare(bv)
          : bv.localeCompare(av);
      }
      return TABLE_SORT_DIR === "asc" ? av - bv : bv - av;
    });
  }

  // Update count label
  const countEl = EL.tableCount();
  if (countEl) countEl.textContent = `${sorted.length} destination${sorted.length !== 1 ? "s" : ""}`;

  // Render rows
  if (sorted.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${TABLE_COLUMNS.length}" class="table-empty">
          No destinations match the current filter criteria.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = sorted.map(row => {
    const cells = TABLE_COLUMNS.map(col => {
      const raw = row[col.key];
      let display = "";
      let cellClass = `td-${col.align}`;

      switch (col.type) {
        case "string":
          display   = `<span class="dest-name">${escapeHtml(raw || "—")}</span>`;
          break;
        case "number":
          display   = formatNumber(raw);
          break;
        case "currency":
          display   = formatCurrency(raw);
          break;
        case "arpu":
          display   = formatARPU(raw);
          break;
        case "pct": {
          const pctVal = parseFloat(raw) || 0;
          const sign   = pctVal >= 0 ? "positive" : "negative";
          display      = `<span class="pct pct--${sign}">${formatPercent(pctVal)}</span>`;
          break;
        }
        case "share":
          display = `${parseFloat(raw).toFixed(2)}%`;
          break;
        case "badge": {
          const cat = (raw || "").toUpperCase();
          display   = `<span class="opp-badge opp-badge--${cat}">${cat}</span>`;
          break;
        }
        default:
          display = raw ?? "—";
      }

      return `<td class="${cellClass}">${display}</td>`;
    });

    return `<tr>${cells.join("")}</tr>`;
  }).join("");
}

/**
 * Update sort indicator arrows in table header.
 */
function updateSortIndicators() {
  document.querySelectorAll("#destTableHead th[data-col]").forEach(th => {
    const icon = th.querySelector(".sort-icon");
    if (!icon) return;
    const col = th.dataset.col;
    if (col === TABLE_SORT_COL) {
      icon.textContent = TABLE_SORT_DIR === "asc" ? " ↑" : " ↓";
      th.classList.add("sorted");
    } else {
      icon.textContent = " ⇅";
      th.classList.remove("sorted");
    }
  });
}

// ── Sales Observations ─────────────────────────────
/**
 * Generate business-style observations from the data.
 * Rules are data-driven — thresholds are computed dynamically.
 * @param {Array} data
 */
function renderObservations(data) {
  const container = document.getElementById("observationsList");
  if (!container || !data || data.length === 0) return;

  const observations = [];

  // Compute aggregate thresholds
  const totalRevenue = data.reduce((s, d) => s + (d.current_revenue || 0), 0);
  const avgGrowth    = data.reduce((s, d) => s + (d.revenue_growth_pct || 0), 0) / data.length;
  const avgARPU      = data.reduce((s, d) => s + (d.arpu || 0), 0) / data.length;

  // Sorted helpers
  const byRevenue    = [...data].sort((a, b) => b.current_revenue - a.current_revenue);
  const byGrowth     = [...data].sort((a, b) => b.revenue_growth_pct - a.revenue_growth_pct);
  const byARPU       = [...data].sort((a, b) => b.arpu - a.arpu);
  const byDecline    = [...data].sort((a, b) => a.revenue_growth_pct - b.revenue_growth_pct);

  // Top revenue contributor
  if (byRevenue[0]) {
    const top = byRevenue[0];
    const shareContrib = ((top.current_revenue / totalRevenue) * 100).toFixed(1);
    observations.push({
      type: "info",
      icon: "📊",
      text: `<strong>${top.destination}</strong> is the top revenue contributor at ${formatCurrency(top.current_revenue)}, representing ${shareContrib}% of total portfolio revenue.`,
    });
  }

  // Strongest growth
  if (byGrowth[0] && byGrowth[0].revenue_growth_pct > 0) {
    const g = byGrowth[0];
    observations.push({
      type: "positive",
      icon: "📈",
      text: `<strong>${g.destination}</strong> shows the strongest revenue growth at <strong>${formatPercent(g.revenue_growth_pct)}</strong> — a priority candidate for increased investment.`,
    });
  }

  // INVEST category destinations
  const investDests = data.filter(d => d.opportunity_category === "INVEST");
  if (investDests.length > 0) {
    observations.push({
      type: "positive",
      icon: "🎯",
      text: `${investDests.length} destination${investDests.length > 1 ? "s" : ""} (${investDests.map(d => d.destination).join(", ")}) are classified as <strong>INVEST</strong> — high growth with strong revenue. Allocate resources accordingly.`,
    });
  }

  // FIX category destinations
  const fixDests = data.filter(d => d.opportunity_category === "FIX");
  if (fixDests.length > 0) {
    observations.push({
      type: "negative",
      icon: "⚠️",
      text: `${fixDests.length} destination${fixDests.length > 1 ? "s" : ""} (${fixDests.map(d => d.destination).join(", ")}) require immediate attention — low growth and low revenue performance.`,
    });
  }

  // Highest ARPU destinations (above average)
  const highARPU = byARPU.filter(d => d.arpu > avgARPU * 1.3).slice(0, 3);
  if (highARPU.length > 0) {
    observations.push({
      type: "info",
      icon: "💰",
      text: `<strong>${highARPU.map(d => d.destination).join(", ")}</strong> exceed the portfolio ARPU average (${formatARPU(avgARPU)}) by more than 30%, indicating high-value customer segments.`,
    });
  }

  // Declining revenue alert
  const declining = byDecline.filter(d => d.revenue_growth_pct < -2).slice(0, 3);
  if (declining.length > 0) {
    observations.push({
      type: "negative",
      icon: "📉",
      text: `<strong>${declining.map(d => d.destination).join(", ")}</strong> show revenue declines exceeding 2%. Review pricing strategy and market conditions for these destinations.`,
    });
  }

  // EXPLORE opportunities
  const exploreDests = data.filter(d => d.opportunity_category === "EXPLORE");
  if (exploreDests.length > 0) {
    observations.push({
      type: "info",
      icon: "🔍",
      text: `<strong>${exploreDests.length} EXPLORE destination${exploreDests.length > 1 ? "s" : ""}</strong> (${exploreDests.map(d => d.destination).join(", ")}) show positive growth momentum but lower revenue — these markets merit further analysis and targeted campaigns.`,
    });
  }

  // Portfolio growth summary
  if (avgGrowth > 0) {
    observations.push({
      type: "positive",
      icon: "✅",
      text: `Overall portfolio revenue growth averages <strong>${formatPercent(avgGrowth)}</strong> across ${data.length} destinations — a positive signal for the current period.`,
    });
  } else {
    observations.push({
      type: "negative",
      icon: "🔔",
      text: `Overall portfolio revenue growth is negative at <strong>${formatPercent(avgGrowth)}</strong> — a portfolio-level review of pricing and sales strategy is recommended.`,
    });
  }

  // Render
  container.innerHTML = observations.map(obs => `
    <div class="obs-item obs-item--${obs.type}">
      <span class="obs-icon">${obs.icon}</span>
      <p class="obs-text">${obs.text}</p>
    </div>
  `).join("");
}

// ── Filter / Dropdown Helpers ──────────────────────
/**
 * Populate the destination filter dropdown from data.
 * @param {Array} data
 */
function populateDestinationFilter(data) {
  const select = EL.filterDestination();
  if (!select) return;

  const dests = [...new Set(data.map(d => d.destination))].sort();
  const existingVals = Array.from(select.options).map(o => o.value);

  dests.forEach(dest => {
    if (!existingVals.includes(dest)) {
      const opt  = document.createElement("option");
      opt.value  = dest;
      opt.textContent = dest;
      select.appendChild(opt);
    }
  });
}

// ── CSV Export ─────────────────────────────────────
/**
 * Export the current filtered table data as a CSV file.
 */
function exportTableCSV() {
  if (!FILTERED_DATA || FILTERED_DATA.length === 0) return;

  const headers = TABLE_COLUMNS.map(c => c.label);
  const rows    = FILTERED_DATA.map(row =>
    TABLE_COLUMNS.map(col => {
      const v = row[col.key];
      if (v === null || v === undefined) return "";
      // Wrap strings containing commas in quotes
      return typeof v === "string" && v.includes(",") ? `"${v}"` : v;
    }).join(",")
  );

  const csv      = [headers.join(","), ...rows].join("\n");
  const blob     = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url      = URL.createObjectURL(blob);
  const link     = document.createElement("a");
  const ts       = new Date().toISOString().slice(0, 10);
  link.href      = url;
  link.download  = `simpulse-export-${ts}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ── UI State Helpers ───────────────────────────────
function showLoading(visible) {
  const el = EL.loadingOverlay();
  if (el) el.classList.toggle("hidden", !visible);
}

function showDashboard(visible) {
  const el = EL.dashboardContent();
  if (el) el.classList.toggle("hidden", !visible);
}

function showError(message) {
  const banner = EL.errorBanner();
  const text   = EL.errorText();
  if (banner) banner.classList.remove("hidden");
  if (text)   text.textContent = message;
}

function hideError() {
  const banner = EL.errorBanner();
  if (banner) banner.classList.add("hidden");
}

function updateLastUpdated() {
  const el = EL.lastUpdated();
  if (el) {
    el.textContent = `Last updated: ${new Date().toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    })}`;
  }
}

// ── Utility ────────────────────────────────────────
/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return String(str).replace(/[&<>"']/g, m => map[m]);
}
