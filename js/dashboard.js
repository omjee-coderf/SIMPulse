/**
 * SIMPulse — Admin Sales Analytics Dashboard Controller (dashboard.js)
 * ─────────────────────────────────────────────────
 * Orchestrates sales data loading, date selection, KPI card updates,
 * daily/monthly/employee chart rendering, employee table search/sorting,
 * CSV report export, and automated observations.
 */

// ── Application State ──────────────────────────────
let SALES_DATA = {
  kpi: {},
  daily: [],
  monthly: [],
  employee: []
};

let DAILY_METRIC = "sales";     // "sales" | "revenue" | "both"
let MONTHLY_METRIC = "sales";   // "sales" | "revenue"
let EMPLOYEE_METRIC = "td_sales"; // "td_sales" | "td_revenue" | "mtd_sales" | "mtd_revenue"

let EMPLOYEE_SEARCH_VAL = "";
let EMPLOYEE_SORT_COL = "td_sales";
let EMPLOYEE_SORT_DIR = "desc";

// ── DOM Element Selectors ──────────────────────────
const EL = {
  loadingOverlay: () => document.getElementById("loadingOverlay"),
  errorBanner: () => document.getElementById("errorBanner"),
  errorText: () => document.getElementById("errorText"),
  dashboardContent: () => document.getElementById("dashboardContent"),
  lastUpdated: () => document.getElementById("lastUpdated"),
  reportDatePicker: () => document.getElementById("reportDatePicker"),
  refreshBtn: () => document.getElementById("refreshBtn"),
  exportBtn: () => document.getElementById("exportBtn"),
  employeeSearchInput: () => document.getElementById("employeeSearchInput"),
  employeeTableHead: () => document.getElementById("employeeTableHead"),
  employeeTableBody: () => document.getElementById("employeeTableBody"),
  employeeCountLabel: () => document.getElementById("employeeCountLabel"),
  observationsList: () => document.getElementById("observationsList")
};

// ── Initialization ─────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // 1. Route guard check — require authenticated user/admin
  const user = await SIMPulseAuth.requireAuth(["user", "admin"]);
  if (!user) return;

  // Render User Header Profile
  setupUserHeaderProfile(user);

  // Check for flash access messages
  checkFlashErrorMessage();

  // Bind UI Events
  bindUIEvents();

  // Load Dashboard Data
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

  const role = (user.role || "admin").toUpperCase();
  if (roleEl) roleEl.textContent = role;

  if (adminBtn && role === "ADMIN") {
    adminBtn.classList.remove("hidden");
  }
}

/**
 * Display flash error banner if redirected from unauthorized page
 */
function checkFlashErrorMessage() {
  const flashMsg = sessionStorage.getItem("simpulse_flash_error");
  if (flashMsg) {
    sessionStorage.removeItem("simpulse_flash_error");
    showError(flashMsg);
  }
}

/**
 * Wire up interactive UI controls.
 */
function bindUIEvents() {
  // Sign Out
  document.getElementById("logoutBtn")?.addEventListener("click", () => SIMPulseAuth.logout());

  // Refresh Button
  EL.refreshBtn()?.addEventListener("click", () => loadDashboard());

  // Date Picker Change
  EL.reportDatePicker()?.addEventListener("change", (e) => loadDashboard(e.target.value));

  // CSV Export Button
  EL.exportBtn()?.addEventListener("click", () => exportSalesReportCSV());

  // Daily Chart Metric Toggles
  document.getElementById("dailyMetricToggle")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".toggle-pill");
    if (!btn) return;
    document.querySelectorAll("#dailyMetricToggle .toggle-pill").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    DAILY_METRIC = btn.dataset.metric;
    renderDailySalesChart(SALES_DATA.daily, DAILY_METRIC);
  });

  // Monthly Chart Metric Toggles
  document.getElementById("monthlyMetricToggle")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".toggle-pill");
    if (!btn) return;
    document.querySelectorAll("#monthlyMetricToggle .toggle-pill").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    MONTHLY_METRIC = btn.dataset.metric;
    renderMonthlySalesChart(SALES_DATA.monthly, MONTHLY_METRIC);
  });

  // Employee Chart Metric Toggles
  document.getElementById("employeeMetricToggle")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".toggle-pill");
    if (!btn) return;
    document.querySelectorAll("#employeeMetricToggle .toggle-pill").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    EMPLOYEE_METRIC = btn.dataset.metric;
    renderEmployeePerformanceChart(SALES_DATA.employee, EMPLOYEE_METRIC);
  });

  // Employee Table Search
  EL.employeeSearchInput()?.addEventListener("input", (e) => {
    EMPLOYEE_SEARCH_VAL = e.target.value.trim().toLowerCase();
    renderEmployeeTable();
  });

  // Employee Table Column Sorting
  EL.employeeTableHead()?.addEventListener("click", (e) => {
    const th = e.target.closest("th[data-col]");
    if (!th) return;
    const col = th.dataset.col;
    if (EMPLOYEE_SORT_COL === col) {
      EMPLOYEE_SORT_DIR = EMPLOYEE_SORT_DIR === "asc" ? "desc" : "asc";
    } else {
      EMPLOYEE_SORT_COL = col;
      EMPLOYEE_SORT_DIR = "desc"; // Default to descending for numeric values
    }
    renderEmployeeTable();
    updateEmployeeSortIndicators();
  });
}

// ── Data Loading & Orchestration ───────────────────
/**
 * Main dashboard loader calling the central API layer.
 * @param {string} [targetDate=null]
 */
async function loadDashboard(targetDate = null) {
  const refreshBtn = EL.refreshBtn();
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.classList.add("is-loading");
  }

  showLoading(true);
  hideError();

  try {
    const picker = EL.reportDatePicker();
    const dateToFetch = targetDate || picker?.value || "2026-08-24";
    if (picker && targetDate) picker.value = targetDate;

    // Call single central API function
    SALES_DATA = await fetchDashboardData(dateToFetch);

    // Validate returned dataset
    if (!SALES_DATA || !SALES_DATA.kpi) {
      throw new Error("API returned an empty or incomplete sales dataset.");
    }

    // Render components using real API response
    updateKPICards(SALES_DATA.kpi);
    renderDailySalesChart(SALES_DATA.daily, DAILY_METRIC);
    renderMonthlySalesChart(SALES_DATA.monthly, MONTHLY_METRIC);
    renderEmployeePerformanceChart(SALES_DATA.employee, EMPLOYEE_METRIC);
    renderEmployeeTable();
    renderSalesObservations(SALES_DATA);

    // Update timestamp
    updateLastUpdated();

    showLoading(false);
    showDashboard(true);
  } catch (err) {
    console.error("[SIMPulse Dashboard] Real API Request Failed:", err);
    showLoading(false);
    showDashboard(false); // Hide stale UI when API fails
    showError(err.message || "Unable to load sales data. Please try again.");
  } finally {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.classList.remove("is-loading");
    }
  }
}


// ── Executive KPI Cards ────────────────────────────
/**
 * Update Executive KPI Card values and comparison indicators.
 * @param {Object} kpi
 */
function updateKPICards(kpi = {}) {
  const todaySales = kpi.today_sales || 0;
  const todayRev = kpi.today_revenue || 0;
  const mtdSales = kpi.mtd_sales || 0;
  const mtdRev = kpi.mtd_revenue || 0;
  const pmSales = kpi.pm_sales || 0;
  const pmRev = kpi.pm_revenue || 0;

  // Calculate MoM growth for MTD vs PM
  const salesMoM = pmSales > 0 ? ((mtdSales - pmSales) / pmSales) * 100 : 0;
  const revMoM = pmRev > 0 ? ((mtdRev - pmRev) / pmRev) * 100 : 0;

  // Today Sales & Revenue
  setKPICard("kpiTodaySalesValue", formatNumber(todaySales));
  setKPICard("kpiTodayRevenueValue", formatCurrency(todayRev));
  setKPICard("kpiTodaySalesSub", `Avg ARPU: ${todaySales > 0 ? formatCurrency(todayRev / todaySales) : "—"}`);

  // Today Revenue Sublabel
  setKPICard("kpiTodayRevenueSub", `Daily Target Pace`);

  // MTD Sales
  setKPICard("kpiMtdSalesValue", formatNumber(mtdSales));
  setKPICard("kpiMtdSalesSub", `${formatPercent(salesMoM)} vs prev. month`);
  setKPIBadge("kpiMtdSalesBadge", salesMoM >= 0 ? "positive" : "negative");

  // MTD Revenue
  setKPICard("kpiMtdRevenueValue", formatCurrency(mtdRev, true));
  setKPICard("kpiMtdRevenueSub", `${formatPercent(revMoM)} vs prev. month`);
  setKPIBadge("kpiMtdRevenueBadge", revMoM >= 0 ? "positive" : "negative");

  // Previous Month Sales & Revenue
  setKPICard("kpiPmSalesValue", formatNumber(pmSales));
  setKPICard("kpiPmRevenueValue", formatCurrency(pmRev, true));
}

function setKPICard(elementId, text) {
  const el = document.getElementById(elementId);
  if (el) el.textContent = text;
}

function setKPIBadge(badgeId, trend) {
  const badge = document.getElementById(badgeId);
  if (!badge) return;
  badge.className = `kpi-badge kpi-badge--${trend}`;
  badge.textContent = trend === "positive" ? "▲" : trend === "negative" ? "▼" : "●";
}

// ── Employee Performance Table ─────────────────────
const EMPLOYEE_COLUMNS = [
  { key: "staff_name", label: "Employee", type: "string", align: "left" },
  { key: "td_sales", label: "Today Sales", type: "number", align: "right" },
  { key: "td_revenue", label: "Today Revenue", type: "currency", align: "right" },
  { key: "mtd_sales", label: "MTD Sales", type: "number", align: "right" },
  { key: "mtd_revenue", label: "MTD Revenue", type: "currency", align: "right" }
];

/**
 * Render Employee Table with filtering and sorting.
 */
function renderEmployeeTable() {
  const tbody = EL.employeeTableBody();
  if (!tbody) return;

  let employees = [...(SALES_DATA.employee || [])];

  // Search Filter
  if (EMPLOYEE_SEARCH_VAL) {
    employees = employees.filter(emp =>
      (emp.staff_name || "").toLowerCase().includes(EMPLOYEE_SEARCH_VAL)
    );
  }

  // Sort
  if (EMPLOYEE_SORT_COL) {
    employees.sort((a, b) => {
      const av = a[EMPLOYEE_SORT_COL];
      const bv = b[EMPLOYEE_SORT_COL];
      if (typeof av === "string") {
        return EMPLOYEE_SORT_DIR === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return EMPLOYEE_SORT_DIR === "asc" ? (av || 0) - (bv || 0) : (bv || 0) - (av || 0);
    });
  }

  // Count Label
  const countLabel = EL.employeeCountLabel();
  if (countLabel) {
    countLabel.textContent = `${employees.length} staff member${employees.length !== 1 ? "s" : ""}`;
  }

  if (employees.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="table-empty">No employees found matching the filter.</td>
      </tr>`;
    return;
  }

  tbody.innerHTML = employees.map(emp => {
    return `
      <tr>
        <td class="td-left"><strong class="emp-name">${escapeHtml(emp.staff_name || "—")}</strong></td>
        <td class="td-right">${formatNumber(emp.td_sales)}</td>
        <td class="td-right">${formatCurrency(emp.td_revenue)}</td>
        <td class="td-right">${formatNumber(emp.mtd_sales)}</td>
        <td class="td-right">${formatCurrency(emp.mtd_revenue)}</td>
      </tr>`;
  }).join("");
}

/**
 * Update column sort indicators on employee table.
 */
function updateEmployeeSortIndicators() {
  document.querySelectorAll("#employeeTableHead th[data-col]").forEach(th => {
    const icon = th.querySelector(".sort-icon");
    if (!icon) return;
    const col = th.dataset.col;
    if (col === EMPLOYEE_SORT_COL) {
      icon.textContent = EMPLOYEE_SORT_DIR === "asc" ? " ↑" : " ↓";
      th.classList.add("sorted");
    } else {
      icon.textContent = " ⇅";
      th.classList.remove("sorted");
    }
  });
}

// ── Automated Sales Observations ───────────────────
/**
 * Calculate data-driven sales observations and insights for executive decision making.
 * @param {Object} data
 */
function renderSalesObservations(data) {
  const container = EL.observationsList();
  if (!container) return;

  const observations = [];

  const kpi = data.kpi || {};
  const daily = data.daily || [];
  const employee = data.employee || [];

  // 1. Top Performing Employee Insight
  if (employee.length > 0) {
    const topEmpToday = [...employee].sort((a, b) => b.td_revenue - a.td_revenue)[0];
    const topEmpMtd = [...employee].sort((a, b) => b.mtd_revenue - a.mtd_revenue)[0];

    if (topEmpToday) {
      observations.push({
        type: "positive",
        icon: "🏆",
        text: `<strong>${topEmpToday.staff_name}</strong> lead today's revenue generation with <strong>${formatCurrency(topEmpToday.td_revenue)}</strong> (${topEmpToday.td_sales} sales).`
      });
    }

    if (topEmpMtd && topEmpMtd.staff_name !== topEmpToday?.staff_name) {
      observations.push({
        type: "info",
        icon: "⭐",
        text: `<strong>${topEmpMtd.staff_name}</strong> is the top MTD producer overall with <strong>${formatCurrency(topEmpMtd.mtd_revenue)}</strong> total revenue generated.`
      });
    }
  }

  // 2. Daily Peak Trend Analysis
  if (daily.length > 0) {
    const sortedDaily = [...daily].sort((a, b) => b.daily_sales - a.daily_sales);
    const peakDay = sortedDaily[0];
    if (peakDay) {
      observations.push({
        type: "info",
        icon: "📈",
        text: `Peak daily sales volume reached <strong>${formatNumber(peakDay.daily_sales)} orders</strong> on <strong>${peakDay.order_date}</strong> generating ${formatCurrency(peakDay.daily_revenue)}.`
      });
    }
  }

  // 3. MTD vs PM Growth Observation
  if (kpi.mtd_revenue && kpi.pm_revenue) {
    const revPace = ((kpi.mtd_revenue - kpi.pm_revenue) / kpi.pm_revenue) * 100;
    if (revPace >= 0) {
      observations.push({
        type: "positive",
        icon: "🚀",
        text: `Month-to-date revenue is trending <strong>${formatPercent(revPace)} higher</strong> compared to the previous month's baseline.`
      });
    } else {
      observations.push({
        type: "negative",
        icon: "⚠️",
        text: `Month-to-date revenue is currently <strong>${formatPercent(revPace)} lower</strong> than the previous month. Increase promotional campaigns to boost sales pace.`
      });
    }
  }

  // Render observations to DOM
  container.innerHTML = observations.map(obs => `
    <div class="obs-item obs-item--${obs.type}">
      <span class="obs-icon">${obs.icon}</span>
      <p class="obs-text">${obs.text}</p>
    </div>
  `).join("");
}

// ── CSV Export Functionality ───────────────────────
/**
 * Export full sales report to CSV format.
 */
function exportSalesReportCSV() {
  if (!SALES_DATA) return;

  const lines = [];
  const dateStr = EL.reportDatePicker()?.value || "2026-08-24";

  // Section 1: KPI Summary
  lines.push(`"SIMPulse Admin Sales Analytics Report - ${dateStr}"`);
  lines.push("");
  lines.push(`"Metric","Value"`);
  lines.push(`"Today Sales","${SALES_DATA.kpi.today_sales || 0}"`);
  lines.push(`"Today Revenue","${SALES_DATA.kpi.today_revenue || 0}"`);
  lines.push(`"MTD Sales","${SALES_DATA.kpi.mtd_sales || 0}"`);
  lines.push(`"MTD Revenue","${SALES_DATA.kpi.mtd_revenue || 0}"`);
  lines.push(`"Previous Month Sales","${SALES_DATA.kpi.pm_sales || 0}"`);
  lines.push(`"Previous Month Revenue","${SALES_DATA.kpi.pm_revenue || 0}"`);
  lines.push("");

  // Section 2: Employee Performance
  lines.push(`"Employee Performance Breakdown"`);
  lines.push(`"Employee","Today Sales","Today Revenue","MTD Sales","MTD Revenue"`);
  (SALES_DATA.employee || []).forEach(emp => {
    lines.push(`"${emp.staff_name || ''}","${emp.td_sales || 0}","${emp.td_revenue || 0}","${emp.mtd_sales || 0}","${emp.mtd_revenue || 0}"`);
  });
  lines.push("");

  // Section 3: Daily Sales
  lines.push(`"Daily Sales Trend"`);
  lines.push(`"Date","Daily Sales","Daily Revenue"`);
  (SALES_DATA.daily || []).forEach(d => {
    lines.push(`"${d.order_date}","${d.daily_sales}","${d.daily_revenue}"`);
  });

  const csvContent = lines.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `simpulse-admin-sales-report-${dateStr}.csv`;
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
  const text = EL.errorText();
  if (banner) banner.classList.remove("hidden");
  if (text) text.textContent = message;
}

function hideError() {
  const banner = EL.errorBanner();
  if (banner) banner.classList.add("hidden");
}

function updateLastUpdated() {
  const el = EL.lastUpdated();
  if (el) {
    el.textContent = `Last Updated: ${new Date().toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short"
    })}`;
  }
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(str) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return String(str).replace(/[&<>"']/g, m => map[m]);
}

