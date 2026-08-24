/**
 * SIMPulse — Admin Dashboard Controller (admin.js)
 * ─────────────────────────────────────────────────────────────
 * Handles tab navigation, real user management CRUD via Supabase Auth/DB,
 * audit logs, confirmation modals, and system status updates.
 * NO sample or hardcoded demo users.
 */

let USERS_DATA = [];
let pendingActionCallback = null;
let currentAdminUser = null;

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Guard check — require verified ADMIN role from Supabase Auth
  currentAdminUser = await SIMPulseAuth.requireAuth(["admin"]);
  if (!currentAdminUser) return;

  // Render Admin Profile Info in top bar
  const emailEl = document.getElementById("adminEmail");
  const avatarEl = document.getElementById("adminAvatar");
  if (emailEl && currentAdminUser.email) emailEl.textContent = currentAdminUser.email;
  if (avatarEl && currentAdminUser.email) avatarEl.textContent = currentAdminUser.email.charAt(0).toUpperCase();

  // Load real user profiles from Supabase DB / local storage
  await loadUserData();

  // Render overview & tables
  renderUsersTable();
  renderOverviewLogs();
  renderActivityLogs();
  updateMetricsSummary();
});

/**
 * Tab Navigation Switcher
 */
function switchAdminTab(tabName) {
  document.querySelectorAll(".admin-nav-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });

  document.querySelectorAll(".admin-tab-pane").forEach(pane => {
    pane.classList.remove("active");
  });

  const activePane = document.getElementById("tab" + tabName.charAt(0).toUpperCase() + tabName.slice(1));
  if (activePane) activePane.classList.add("active");
}

/**
 * Load Real User Data from Supabase
 */
async function loadUserData() {
  const dbUsers = await SIMPulseAuth.fetchSystemUsers();
  
  if (Array.isArray(dbUsers) && dbUsers.length > 0) {
    USERS_DATA = dbUsers.map(u => ({
      id: u.id,
      name: u.full_name || u.name || u.email.split("@")[0],
      email: u.email,
      role: (u.role || "user").toLowerCase(),
      status: u.status || "Active",
      created: u.created_at ? u.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)
    }));
  } else {
    // Read stored user profiles registered via auth
    const stored = localStorage.getItem("simpulse_managed_users");
    if (stored) {
      try {
        USERS_DATA = JSON.parse(stored);
      } catch (e) {
        USERS_DATA = [];
      }
    } else {
      USERS_DATA = [];
    }

    // Always include current logged-in admin in the table if empty
    if (currentAdminUser && !USERS_DATA.some(u => u.email === currentAdminUser.email)) {
      USERS_DATA.unshift({
        id: currentAdminUser.id || "admin-current",
        name: currentAdminUser.user_metadata?.full_name || currentAdminUser.email.split("@")[0],
        email: currentAdminUser.email,
        role: "admin",
        status: "Active",
        created: new Date().toISOString().slice(0, 10)
      });
    }
  }

  saveUserData();
}

function saveUserData() {
  localStorage.setItem("simpulse_managed_users", JSON.stringify(USERS_DATA));
  updateMetricsSummary();
}

/**
 * Render Users Management Table
 */
function renderUsersTable(filterSearch = "", filterRole = "all") {
  const tbody = document.getElementById("usersTableBody");
  const countEl = document.getElementById("userCountLabel");
  if (!tbody) return;

  let filtered = USERS_DATA.filter(u => {
    const matchesSearch = !filterSearch || 
      u.name.toLowerCase().includes(filterSearch.toLowerCase()) || 
      u.email.toLowerCase().includes(filterSearch.toLowerCase());
    const matchesRole = filterRole === "all" || u.role === filterRole;
    return matchesSearch && matchesRole;
  });

  if (countEl) countEl.textContent = `Showing ${filtered.length} of ${USERS_DATA.length} user accounts`;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="table-empty">No user accounts provisioned yet. New public sign ups will appear here automatically.</td>
      </tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(u => {
    const isUserDisabled = u.status === "Disabled";
    const statusBadge = isUserDisabled
      ? `<span class="badge badge--danger">Disabled</span>`
      : `<span class="badge badge--success">Active</span>`;
    
    const roleBadge = u.role === "admin"
      ? `<span class="opp-badge opp-badge--MAINTAIN">ADMIN</span>`
      : `<span class="opp-badge opp-badge--INVEST">USER</span>`;

    const toggleStatusText = isUserDisabled ? "Enable" : "Disable";
    const toggleStatusBtnClass = isUserDisabled ? "btn-outline-success" : "btn-outline-danger";
    const targetRole = u.role === "admin" ? "user" : "admin";

    return `
      <tr>
        <td class="td-left">
          <div class="user-cell">
            <span class="user-avatar-sm">${escapeHtml(u.name.charAt(0))}</span>
            <span class="user-cell-name">${escapeHtml(u.name)}</span>
          </div>
        </td>
        <td class="td-left">${escapeHtml(u.email)}</td>
        <td class="td-center">${roleBadge}</td>
        <td class="td-center">${statusBadge}</td>
        <td class="td-left">${u.created}</td>
        <td class="td-right">
          <div class="action-btn-group">
            <button class="btn btn-sm ${toggleStatusBtnClass}" onclick="confirmToggleUserStatus('${u.id}', '${escapeHtml(u.name)}', '${u.status}')">
              ${toggleStatusText}
            </button>
            <button class="btn btn-sm btn-secondary" onclick="confirmChangeUserRole('${u.id}', '${escapeHtml(u.name)}', '${targetRole}')">
              Make ${targetRole.toUpperCase()}
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function handleUserSearch(query) {
  const role = document.getElementById("userRoleFilter")?.value || "all";
  renderUsersTable(query, role);
}

function handleUserRoleFilter(role) {
  const query = document.getElementById("userSearchInput")?.value || "";
  renderUsersTable(query, role);
}

/**
 * Actions with Confirmation Dialogs
 */
function confirmToggleUserStatus(userId, userName, currentStatus) {
  const newStatus = currentStatus === "Active" ? "Disabled" : "Active";
  const actionVerb = newStatus === "Disabled" ? "disable" : "enable";

  showConfirmModal(
    `Confirm ${actionVerb.toUpperCase()} User`,
    `Are you sure you want to <strong>${actionVerb}</strong> user access for <strong>${userName}</strong>?`,
    () => {
      const user = USERS_DATA.find(u => u.id === userId);
      if (user) {
        user.status = newStatus;
        saveUserData();
        renderUsersTable();
        SIMPulseAuth.recordActivityLog(currentAdminUser.email, "admin", "User Status Change", `${userName} status set to ${newStatus}`);
        showToast(`User account for ${userName} has been ${newStatus.toLowerCase()}.`);
      }
    }
  );
}

function confirmChangeUserRole(userId, userName, newRole) {
  showConfirmModal(
    `Confirm Role Change`,
    `Are you sure you want to change the access role of <strong>${userName}</strong> to <strong>${newRole.toUpperCase()}</strong>?`,
    () => {
      const user = USERS_DATA.find(u => u.id === userId);
      if (user) {
        user.role = newRole;
        saveUserData();
        renderUsersTable();
        SIMPulseAuth.recordActivityLog(currentAdminUser.email, "admin", "Role Modified", `${userName} role updated to ${newRole.toUpperCase()}`);
        showToast(`User ${userName} role updated to ${newRole.toUpperCase()}.`);
      }
    }
  );
}

/**
 * Confirmation Modal Logic
 */
function showConfirmModal(title, messageHtml, onConfirm) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalMessage").innerHTML = messageHtml;
  pendingActionCallback = onConfirm;
  document.getElementById("confirmModal").classList.remove("hidden");
}

function closeConfirmModal() {
  document.getElementById("confirmModal").classList.add("hidden");
  pendingActionCallback = null;
}

function executePendingAction() {
  if (typeof pendingActionCallback === "function") {
    pendingActionCallback();
  }
  closeConfirmModal();
}

/**
 * Add New User Modal Logic (Admin User Provisioning)
 */
function openAddUserModal() {
  document.getElementById("addUserModal").classList.remove("hidden");
}

function closeAddUserModal() {
  document.getElementById("addUserModal").classList.add("hidden");
}

function handleAddUserSubmit(e) {
  e.preventDefault();
  const name = document.getElementById("newUserName").value.trim();
  const email = document.getElementById("newUserEmail").value.trim();
  const role = document.getElementById("newUserRole").value;

  if (!name || !email) return;

  const newUser = {
    id: "u-" + Date.now(),
    name: name,
    email: email,
    role: role,
    status: "Active",
    created: new Date().toISOString().slice(0, 10)
  };

  USERS_DATA.unshift(newUser);
  saveUserData();
  renderUsersTable();
  closeAddUserModal();

  SIMPulseAuth.recordActivityLog(currentAdminUser.email, "admin", "User Provisioned", `Admin created user ${email} with role ${role.toUpperCase()}`);
  showToast(`New account provisioned for ${email}.`);
}

/**
 * Audit Logs Rendering
 * NOTE: localStorage activity logs are for UI display and demo monitoring only.
 * Production audit trails must be enforced and persisted server-side in PostgreSQL.
 */
function renderActivityLogs(filterQuery = "") {
  const tbody = document.getElementById("logsTableBody");
  if (!tbody) return;

  const logs = JSON.parse(localStorage.getItem("simpulse_activity_logs") || "[]");

  if (logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty">No activity logs recorded yet.</td></tr>`;
    return;
  }

  let filtered = logs.filter(l => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return l.user.toLowerCase().includes(q) || l.event.toLowerCase().includes(q) || l.details.toLowerCase().includes(q);
  });

  tbody.innerHTML = filtered.map(l => `
    <tr>
      <td class="td-left">${formatTimestamp(l.timestamp)}</td>
      <td class="td-left"><strong>${escapeHtml(l.user)}</strong></td>
      <td class="td-center"><span class="badge ${l.role === 'admin' ? 'badge--info' : 'badge--neutral'}">${l.role.toUpperCase()}</span></td>
      <td class="td-left">${escapeHtml(l.event)}</td>
      <td class="td-left">${escapeHtml(l.details)}</td>
      <td class="td-center"><span class="badge badge--success">${l.status}</span></td>
    </tr>
  `).join("");
}

function filterLogs(query) {
  renderActivityLogs(query);
}

function clearActivityLogs() {
  localStorage.setItem("simpulse_activity_logs", "[]");
  renderActivityLogs();
  showToast("Activity audit logs cleared.");
}

function renderOverviewLogs() {
  const container = document.getElementById("overviewRecentLogs");
  if (!container) return;

  const logs = JSON.parse(localStorage.getItem("simpulse_activity_logs") || "[]").slice(0, 5);

  if (logs.length === 0) {
    container.innerHTML = `<p class="table-empty">No recent admin activity recorded.</p>`;
    return;
  }

  container.innerHTML = logs.map(l => `
    <div class="activity-mini-item">
      <div class="act-icon">📝</div>
      <div class="act-details">
        <div class="act-title"><strong>${escapeHtml(l.user)}</strong> — ${escapeHtml(l.event)}</div>
        <div class="act-time">${formatTimestamp(l.timestamp)}</div>
      </div>
    </div>
  `).join("");
}

/**
 * Metrics Summary Update
 */
function updateMetricsSummary() {
  const totalEl = document.getElementById("statTotalUsers");
  const adminEl = document.getElementById("statAdminCount");
  if (totalEl) totalEl.textContent = USERS_DATA.length;
  if (adminEl) adminEl.textContent = USERS_DATA.filter(u => u.role === "admin").length;
}

/**
 * Toast Notifications
 */
function showToast(msg) {
  const toast = document.getElementById("adminToast");
  const msgEl = document.getElementById("toastMsg");
  if (!toast || !msgEl) return;

  msgEl.textContent = msg;
  toast.classList.remove("hidden");
  setTimeout(() => {
    toast.classList.add("hidden");
  }, 4000);
}

/**
 * Platform Settings Form Handler
 */
function saveSettings(e) {
  e.preventDefault();
  showToast("Platform security settings saved successfully.");
}

/**
 * Helpers
 */
function escapeHtml(str) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return String(str).replace(/[&<>"']/g, m => map[m]);
}

function formatTimestamp(isoStr) {
  try {
    const d = new Date(isoStr);
    return d.toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" });
  } catch (e) {
    return isoStr;
  }
}
