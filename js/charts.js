/**
 * SIMPulse — Chart Renderers (charts.js)
 * ─────────────────────────────────────────────────
 * Renders Chart.js visualizations for PRD Admin Analytics:
 * 1. Daily Sales & Revenue Line Chart
 * 2. Monthly Sales Bar Chart
 * 3. Employee Performance Horizontal Bar Chart
 */

// ── Palette & Styles ──────────────────────────────
const PALETTE = {
  blue: "#1d4ed8",
  blueLight: "#3b82f6",
  blueAlpha: "rgba(29, 78, 216, 0.15)",
  green: "#16a34a",
  greenLight: "#22c55e",
  greenAlpha: "rgba(22, 163, 74, 0.15)",
  purple: "#7c3aed",
  purpleAlpha: "rgba(124, 58, 237, 0.15)",
  slate: "#374151",
  grayLight: "#e5e7eb",
};

// Global chart instances cache for cleanup
const chartInstances = {};

/**
 * Destroy existing Chart instance before re-creating.
 * @param {string} id
 */
function destroyChart(id) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
    delete chartInstances[id];
  }
}

// Chart.js defaults
if (typeof Chart !== "undefined") {
  Chart.defaults.font.family = "'Inter', 'Segoe UI', system-ui, sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.color = PALETTE.slate;
}

// ── 1. Daily Sales & Revenue Line Chart ─────────────
/**
 * Render Daily Sales & Revenue Trend Line Chart.
 * @param {Array} dailyData - Array of { order_date, daily_sales, daily_revenue }
 * @param {string} [metric="sales"] - "sales" | "revenue" | "both"
 */
function renderDailySalesChart(dailyData = [], metric = "sales") {
  destroyChart("dailySalesChart");

  const canvas = document.getElementById("dailySalesChart");
  if (!canvas || !dailyData || dailyData.length === 0) return;

  const labels = dailyData.map(d => {
    const parts = d.order_date.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
    return d.order_date;
  });

  const datasets = [];

  if (metric === "sales" || metric === "both") {
    datasets.push({
      label: "Daily Sales (Orders)",
      data: dailyData.map(d => d.daily_sales),
      borderColor: PALETTE.blue,
      backgroundColor: PALETTE.blueAlpha,
      borderWidth: 2.5,
      tension: 0.35,
      fill: metric !== "both",
      pointRadius: 3,
      pointHoverRadius: 6,
      yAxisID: "ySales"
    });
  }

  if (metric === "revenue" || metric === "both") {
    datasets.push({
      label: "Daily Revenue (₹)",
      data: dailyData.map(d => d.daily_revenue),
      borderColor: PALETTE.green,
      backgroundColor: PALETTE.greenAlpha,
      borderWidth: 2.5,
      tension: 0.35,
      fill: metric !== "both",
      pointRadius: 3,
      pointHoverRadius: 6,
      yAxisID: metric === "both" ? "yRevenue" : "ySales"
    });
  }

  const scales = {
    x: {
      grid: { display: false },
      ticks: { maxRotation: 45 }
    },
    ySales: {
      type: "linear",
      position: "left",
      grid: { color: PALETTE.grayLight },
      title: {
        display: true,
        text: metric === "revenue" ? "Revenue (₹)" : "Sales Volume (Orders)",
        font: { size: 11, weight: "600" }
      },
      ticks: {
        callback: v => metric === "revenue" ? formatCurrency(v, true) : formatNumber(v)
      }
    }
  };

  if (metric === "both") {
    scales.yRevenue = {
      type: "linear",
      position: "right",
      grid: { display: false },
      title: {
        display: true,
        text: "Revenue (₹)",
        font: { size: 11, weight: "600" },
        color: PALETTE.green
      },
      ticks: {
        callback: v => formatCurrency(v, true)
      }
    };
  }

  const ctx = canvas.getContext("2d");
  chartInstances["dailySalesChart"] = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          display: metric === "both",
          position: "top"
        },
        tooltip: {
          callbacks: {
            title: ctx => `Date: ${dailyData[ctx[0].dataIndex]?.order_date || ""}`,
            label: ctx => {
              const isRev = ctx.dataset.label.includes("Revenue");
              return ` ${ctx.dataset.label}: ${isRev ? formatCurrency(ctx.raw) : formatNumber(ctx.raw)}`;
            }
          }
        }
      },
      scales
    }
  });
}

// ── 2. Monthly Sales Bar Chart ──────────────────────
/**
 * Render Monthly Performance Bar Chart.
 * @param {Array} monthlyData - Array of { order_month, month_label, monthly_sales, monthly_revenue }
 * @param {string} [metric="sales"] - "sales" | "revenue"
 */
function renderMonthlySalesChart(monthlyData = [], metric = "sales") {
  destroyChart("monthlySalesChart");

  const canvas = document.getElementById("monthlySalesChart");
  if (!canvas || !monthlyData || monthlyData.length === 0) return;

  const labels = monthlyData.map(d => d.month_label || d.order_month);
  const values = monthlyData.map(d => metric === "revenue" ? d.monthly_revenue : d.monthly_sales);

  const ctx = canvas.getContext("2d");
  chartInstances["monthlySalesChart"] = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: metric === "revenue" ? "Monthly Revenue (₹)" : "Monthly Sales (Orders)",
        data: values,
        backgroundColor: metric === "revenue" ? PALETTE.greenLight : PALETTE.blueLight,
        borderColor: metric === "revenue" ? PALETTE.green : PALETTE.blue,
        borderWidth: 1.5,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${metric === "revenue" ? formatCurrency(ctx.raw) : formatNumber(ctx.raw)}`
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          grid: { color: PALETTE.grayLight },
          ticks: {
            callback: v => metric === "revenue" ? formatCurrency(v, true) : formatNumber(v)
          }
        }
      }
    }
  });
}

// ── 3. Employee Performance Horizontal Bar Chart ───
/**
 * Render Employee Ranking Horizontal Bar Chart.
 * @param {Array} employeeData - Array of employee records
 * @param {string} [metric="td_sales"] - "td_sales" | "td_revenue" | "mtd_sales" | "mtd_revenue"
 */
function renderEmployeePerformanceChart(employeeData = [], metric = "td_sales") {
  destroyChart("employeePerformanceChart");

  const canvas = document.getElementById("employeePerformanceChart");
  if (!canvas || !employeeData || employeeData.length === 0) return;

  // Sort employee data descending by chosen metric
  const sorted = [...employeeData].sort((a, b) => (b[metric] || 0) - (a[metric] || 0));

  const labels = sorted.map(d => d.staff_name);
  const values = sorted.map(d => d[metric] || 0);

  const isRevenueMetric = metric.includes("revenue");

  const ctx = canvas.getContext("2d");
  chartInstances["employeePerformanceChart"] = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: getMetricLabel(metric),
        data: values,
        backgroundColor: isRevenueMetric ? "rgba(22, 163, 74, 0.75)" : "rgba(29, 78, 216, 0.75)",
        borderColor: isRevenueMetric ? PALETTE.green : PALETTE.blue,
        borderWidth: 1.5,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${getMetricLabel(metric)}: ${isRevenueMetric ? formatCurrency(ctx.raw) : formatNumber(ctx.raw)}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: PALETTE.grayLight },
          ticks: {
            callback: v => isRevenueMetric ? formatCurrency(v, true) : formatNumber(v)
          }
        },
        y: {
          grid: { display: false }
        }
      }
    }
  });
}

/**
 * Utility helper to get readable chart label from metric key
 */
function getMetricLabel(metricKey) {
  switch (metricKey) {
    case "td_sales": return "Today Sales";
    case "td_revenue": return "Today Revenue";
    case "mtd_sales": return "MTD Sales";
    case "mtd_revenue": return "MTD Revenue";
    default: return "Value";
  }
}

