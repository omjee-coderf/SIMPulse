/**
 * SIMPulse — Chart Renderers (charts.js)
 * ─────────────────────────────────────────────────
 * All Chart.js visualizations live here.
 * Each function accepts processed data and renders
 * into its respective canvas element.
 */

// ── Shared Palette ─────────────────────────────────
const PALETTE = {
  blue       : "#1d4ed8",
  blueLight  : "#3b82f6",
  blueAlpha  : "rgba(29, 78, 216, 0.15)",
  green      : "#16a34a",
  greenAlpha : "rgba(22, 163, 74, 0.15)",
  red        : "#dc2626",
  redAlpha   : "rgba(220, 38, 38, 0.15)",
  gray       : "#6b7280",
  grayLight  : "#e5e7eb",
  slate      : "#374151",
  amber      : "#d97706",
  purple     : "#7c3aed",
  teal       : "#0d9488",
};

// Opportunity category colour map
const OPPORTUNITY_COLORS = {
  INVEST  : { bg: "rgba(22,  163,  74, 0.75)", border: "#16a34a" },
  MAINTAIN: { bg: "rgba(29,  78,  216, 0.75)", border: "#1d4ed8" },
  EXPLORE : { bg: "rgba(217, 119,   6, 0.75)", border: "#d97706" },
  FIX     : { bg: "rgba(220,  38,  38, 0.75)", border: "#dc2626" },
};

// Store chart instances for proper destroy/re-render
const chartInstances = {};

/**
 * Destroy an existing Chart.js instance before creating a new one.
 * Prevents "Canvas already in use" warnings.
 * @param {string} id — canvas element id
 */
function destroyChart(id) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
    delete chartInstances[id];
  }
}

// ── Shared chart defaults ──────────────────────────
Chart.defaults.font.family = "'Inter', 'Segoe UI', system-ui, sans-serif";
Chart.defaults.font.size   = 12;
Chart.defaults.color       = PALETTE.slate;

// ── 1. Revenue Growth Bar Chart ────────────────────
/**
 * Render the Revenue Growth % bar chart.
 * Bars above zero are green, below zero are red.
 * @param {Array} data — raw API destination records
 */
function renderRevenueGrowthChart(data) {
  destroyChart("revenueGrowthChart");

  const sorted   = [...data].sort((a, b) => b.revenue_growth_pct - a.revenue_growth_pct);
  const labels   = sorted.map(d => d.destination);
  const values   = sorted.map(d => d.revenue_growth_pct);
  const bgColors = values.map(v => v >= 0 ? "rgba(22, 163, 74, 0.80)" : "rgba(220, 38, 38, 0.80)");
  const borders  = values.map(v => v >= 0 ? PALETTE.green : PALETTE.red);

  const ctx = document.getElementById("revenueGrowthChart").getContext("2d");

  chartInstances["revenueGrowthChart"] = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label          : "Revenue Growth %",
        data           : values,
        backgroundColor: bgColors,
        borderColor    : borders,
        borderWidth    : 1.5,
        borderRadius   : 4,
        borderSkipped  : false,
      }],
    },
    options: {
      responsive         : true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${formatPercent(ctx.raw)} revenue growth`,
          },
        },
      },
      scales: {
        x: {
          grid  : { display: false },
          ticks : { maxRotation: 45, minRotation: 30 },
        },
        y: {
          grid: { color: PALETTE.grayLight },
          ticks: {
            callback: v => `${v > 0 ? "+" : ""}${v}%`,
          },
        },
      },
    },
  });
}

// ── 2. Market Share Donut Chart ─────────────────────
/**
 * Render the Market Contribution donut chart.
 * @param {Array} data — raw API destination records
 */
function renderMarketShareChart(data) {
  destroyChart("marketShareChart");

  // Sort descending, group small slices into "Others"
  const sorted = [...data].sort((a, b) => b.market_share_pct - a.market_share_pct);
  const TOP_N  = 10;
  const top    = sorted.slice(0, TOP_N);
  const rest   = sorted.slice(TOP_N);

  const labels = top.map(d => d.destination);
  const values = top.map(d => d.market_share_pct);

  if (rest.length > 0) {
    const othersSum = rest.reduce((s, d) => s + d.market_share_pct, 0);
    labels.push("Others");
    values.push(parseFloat(othersSum.toFixed(2)));
  }

  // Professional multi-tone palette (not garish)
  const donutPalette = [
    "#1d4ed8","#2563eb","#3b82f6","#60a5fa",
    "#16a34a","#22c55e","#4ade80",
    "#d97706","#f59e0b","#fcd34d",
    "#7c3aed","#9333ea",
  ];

  const ctx = document.getElementById("marketShareChart").getContext("2d");

  chartInstances["marketShareChart"] = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data           : values,
        backgroundColor: donutPalette.slice(0, labels.length),
        borderColor    : "#ffffff",
        borderWidth    : 2,
        hoverOffset    : 8,
      }],
    },
    options: {
      responsive         : true,
      maintainAspectRatio: false,
      cutout             : "62%",
      plugins: {
        legend: {
          position : "right",
          labels   : {
            boxWidth    : 12,
            padding     : 14,
            font        : { size: 11 },
            usePointStyle: true,
            pointStyle  : "rectRounded",
          },
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.raw.toFixed(2)}% market share`,
          },
        },
      },
    },
  });
}

// ── 3. ARPU Horizontal Bar Chart ───────────────────
/**
 * Render the ARPU horizontal bar chart.
 * @param {Array} data — raw API destination records
 */
function renderARPUChart(data) {
  destroyChart("arpuChart");

  const sorted = [...data].sort((a, b) => b.arpu - a.arpu);
  const labels = sorted.map(d => d.destination);
  const values = sorted.map(d => d.arpu);

  // Gradient intensity: darker blue for highest ARPU
  const maxArpu  = Math.max(...values);
  const bgColors = values.map(v => {
    const ratio   = v / maxArpu;
    const opacity = 0.35 + ratio * 0.55;
    return `rgba(29, 78, 216, ${opacity.toFixed(2)})`;
  });

  const ctx = document.getElementById("arpuChart").getContext("2d");

  chartInstances["arpuChart"] = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label          : "ARPU (USD)",
        data           : values,
        backgroundColor: bgColors,
        borderColor    : PALETTE.blue,
        borderWidth    : 1,
        borderRadius   : 4,
        borderSkipped  : false,
      }],
    },
    options: {
      responsive         : true,
      maintainAspectRatio: false,
      indexAxis          : "y",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ARPU: ${formatARPU(ctx.raw)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: PALETTE.grayLight },
          ticks: {
            callback: v => `$${v.toLocaleString()}`,
          },
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: 11 } },
        },
      },
    },
  });
}

// ── 4. Opportunity Matrix Scatter Chart ────────────
/**
 * Render the Opportunity Matrix (Revenue vs Growth %).
 * Points are coloured and grouped by opportunity_category.
 * @param {Array} data — raw API destination records
 */
function renderOpportunityMatrix(data) {
  destroyChart("opportunityChart");

  // Group data by category
  const groups = {};
  data.forEach(d => {
    const cat = d.opportunity_category || "FIX";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push({
      x   : d.current_revenue,
      y   : d.revenue_growth_pct,
      label: d.destination,
    });
  });

  const datasets = Object.entries(groups).map(([cat, points]) => ({
    label          : cat,
    data           : points,
    backgroundColor: (OPPORTUNITY_COLORS[cat] || OPPORTUNITY_COLORS.FIX).bg,
    borderColor    : (OPPORTUNITY_COLORS[cat] || OPPORTUNITY_COLORS.FIX).border,
    borderWidth    : 1.5,
    pointRadius    : 7,
    pointHoverRadius: 10,
  }));

  const ctx = document.getElementById("opportunityChart").getContext("2d");

  chartInstances["opportunityChart"] = new Chart(ctx, {
    type: "scatter",
    data: { datasets },
    options: {
      responsive         : true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels  : { usePointStyle: true, padding: 16, font: { size: 11 } },
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              const pt = ctx.raw;
              return [
                ` ${pt.label}`,
                ` Revenue: ${formatCurrency(pt.x)}`,
                ` Growth: ${formatPercent(pt.y)}`,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text   : "Current Revenue (USD)",
            font   : { size: 11, weight: "600" },
            color  : PALETTE.slate,
          },
          grid : { color: PALETTE.grayLight },
          ticks: { callback: v => `$${(v / 1000).toFixed(0)}k` },
        },
        y: {
          title: {
            display: true,
            text   : "Revenue Growth %",
            font   : { size: 11, weight: "600" },
            color  : PALETTE.slate,
          },
          grid : { color: PALETTE.grayLight },
          ticks: { callback: v => `${v > 0 ? "+" : ""}${v}%` },
        },
      },
    },
  });
}

// ── 5. Revenue vs Orders Scatter Chart ─────────────
/**
 * Render the Revenue vs Orders relationship scatter chart.
 * @param {Array} data — raw API destination records
 */
function renderRevenueOrderChart(data) {
  destroyChart("revenueOrderChart");

  const points = data.map(d => ({
    x    : d.current_orders,
    y    : d.current_revenue,
    label: d.destination,
  }));

  const ctx = document.getElementById("revenueOrderChart").getContext("2d");

  chartInstances["revenueOrderChart"] = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [{
        label          : "Destinations",
        data           : points,
        backgroundColor: "rgba(29, 78, 216, 0.65)",
        borderColor    : PALETTE.blue,
        borderWidth    : 1.5,
        pointRadius    : 7,
        pointHoverRadius: 10,
      }],
    },
    options: {
      responsive         : true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const pt = ctx.raw;
              return [
                ` ${pt.label}`,
                ` Orders: ${formatNumber(pt.x)}`,
                ` Revenue: ${formatCurrency(pt.y)}`,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text   : "Current Orders",
            font   : { size: 11, weight: "600" },
            color  : PALETTE.slate,
          },
          grid : { color: PALETTE.grayLight },
          ticks: { callback: v => formatNumber(v) },
        },
        y: {
          title: {
            display: true,
            text   : "Current Revenue (USD)",
            font   : { size: 11, weight: "600" },
            color  : PALETTE.slate,
          },
          grid : { color: PALETTE.grayLight },
          ticks: { callback: v => `$${(v / 1000).toFixed(0)}k` },
        },
      },
    },
  });
}
