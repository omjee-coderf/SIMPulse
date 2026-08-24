/**
 * SIMPulse — Authentication & Authorization Module (auth.js)
 * ─────────────────────────────────────────────────────────────
 * Single Supabase Auth management system for SIMPulse.
 * Enforces SECURE role-based authorization for 'user' and 'admin'.
 * Uses real Supabase Auth accounts ONLY. No demo/fake data.
 * Uses public anon key only — NEVER exposes service_role key.
 */

const SUPABASE_URL = "https://pmfiamiebikefcraahjd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtZmlhbWllYmlrZWZjcmFhaGpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2ODgyNDAsImV4cCI6MjA5NzI2NDI0MH0.Z9XCGCz9-_fuIFocdqUXauLrgsNo91ZNrMLIBGpI7EA";

// Centralized credentials exposed on window object for shared module access
if (typeof window !== "undefined") {
  window.SUPABASE_URL = SUPABASE_URL;
  window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
}

// Storage key for caching session role
const STORAGE_ROLE_KEY = "simpulse_auth_role";

let supabaseClient = null;

/**
 * Initialize and get the Supabase Client singleton.
 */
function getSupabaseClient() {
  if (!supabaseClient) {
    if (typeof window.supabase !== "undefined" && window.supabase.createClient) {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
      console.error("[SIMPulseAuth] Supabase SDK library not loaded on page.");
    }
  }
  return supabaseClient;
}

const SIMPulseAuth = {
  /**
   * Get active Supabase Auth session from server/storage.
   */
  async getSession() {
    const client = getSupabaseClient();
    if (!client) return null;
    try {
      const { data: { session }, error } = await client.auth.getSession();
      if (error) {
        console.error("[SIMPulseAuth] Error fetching session:", error);
        return null;
      }
      return session;
    } catch (e) {
      console.error("[SIMPulseAuth] Session exception:", e);
      return null;
    }
  },

  /**
   * Fetch authenticated user record securely from Supabase Auth.
   */
  async getAuthenticatedUser() {
    const client = getSupabaseClient();
    if (!client) return null;
    try {
      const { data: { user }, error } = await client.auth.getUser();
      if (error || !user) return null;
      return user;
    } catch (e) {
      console.error("[SIMPulseAuth] User fetch exception:", e);
      return null;
    }
  },

  /**
   * Determine the current user's SECURE role from Supabase metadata/profiles.
   * Priority:
   * 1. Supabase app_metadata.role (server-controlled JWT claim)
   * 2. Supabase profiles database table lookup
   * 3. Default strictly to 'user' for security.
   * Note: user_metadata is user-editable via client SDK and MUST NOT grant admin privileges.
   * Frontend inputs or localStorage NEVER grant or escalate role!
   */
  async fetchUserSecureRole(user) {
    if (!user) return "user";

    let role = null;

    // 1. Check secure Supabase JWT app_metadata (server-controlled)
    if (user.app_metadata && user.app_metadata.role) {
      role = user.app_metadata.role;
    }

    // 2. Check Supabase profiles table if role is not in app_metadata
    if (!role && user.id) {
      const client = getSupabaseClient();
      if (client) {
        try {
          const { data, error } = await client
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();

          if (!error && data && data.role) {
            role = data.role;
          }
        } catch (e) {
          // Table query exception handled silently
        }
      }
    }

    // 3. Fallback check for user_metadata (ONLY allow 'user', never elevate to 'admin')
    if (!role && user.user_metadata && user.user_metadata.role === "user") {
      role = "user";
    }

    role = (role || "user").toLowerCase();
    
    // Strict security check: only 'admin' or 'user' allowed
    if (role !== "admin") role = "user";

    localStorage.setItem(STORAGE_ROLE_KEY, role);
    return role;
  },

  /**
   * Log in user using REAL Supabase Auth credentials.
   * Flow: Email + Password -> Supabase Auth -> Authenticated User ID -> Fetch Secure Role -> Authorize
   */
  async login(email, password) {
    if (!email || !password) {
      throw new Error("Please enter both email and password.");
    }

    const client = getSupabaseClient();
    if (!client) {
      throw new Error("Supabase authentication service is unavailable. Please refresh.");
    }

    const { data, error } = await client.auth.signInWithPassword({ email, password });

    if (error) {
      console.error("[SIMPulseAuth] Sign in failed:", error.message);
      if (error.message.includes("Invalid login credentials")) {
        throw new Error("Invalid email or password. Please check your credentials.");
      }
      throw error;
    }

    const user = data.user;
    const session = data.session;

    // Fetch SECURE role from database/metadata
    const actualRole = await this.fetchUserSecureRole(user);

    // Audit log
    this.recordActivityLog(user.email, actualRole, "Login", `Real user session authenticated. Role: ${actualRole.toUpperCase()}`);

    return { user, role: actualRole, session };
  },

  /**
   * Register a new public user account via Supabase Auth.
   * Public sign-ups are STRICTLY assigned role = 'user'.
   * Normal users CANNOT choose or submit role = 'admin'.
   */
  async signup(fullName, email, password, confirmPassword) {
    if (!fullName || !email || !password || !confirmPassword) {
      throw new Error("All fields are required.");
    }

    if (password !== confirmPassword) {
      throw new Error("Passwords do not match. Please verify your password.");
    }

    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters long.");
    }

    const client = getSupabaseClient();
    if (!client) {
      throw new Error("Supabase authentication service is unavailable.");
    }

    // STRICT SECURITY: Public sign-ups ALWAYS receive role = 'user'
    const assignedRole = "user";

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: assignedRole // STRICTLY 'user'
        }
      }
    });

    if (error) {
      console.error("[SIMPulseAuth] Sign up failed:", error.message);
      throw error;
    }

    // Attempt profile record insert in profiles table if it exists
    if (data?.user) {
      try {
        await client.from("profiles").insert([
          {
            id: data.user.id,
            full_name: fullName,
            email: email,
            role: assignedRole,
            created_at: new Date().toISOString()
          }
        ]);
      } catch (e) {
        // Handled if profiles table is managed by Supabase triggers
      }
    }

    // Audit log
    this.recordActivityLog(email, assignedRole, "Public Account Registration", `Created account for ${fullName}. Assigned role: USER`);

    // Check if email confirmation is required by Supabase configuration
    const requiresEmailConfirmation = data.user && !data.session;

    return {
      user: data.user,
      role: assignedRole,
      requiresEmailConfirmation: requiresEmailConfirmation
    };
  },

  /**
   * Request password reset email via Supabase Auth.
   */
  async resetPassword(email) {
    if (!email) {
      throw new Error("Please enter your registered email address.");
    }

    const client = getSupabaseClient();
    if (!client) {
      throw new Error("Supabase authentication service is unavailable.");
    }

    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login.html?reset=true`
    });

    if (error) {
      console.error("[SIMPulseAuth] Password reset failed:", error.message);
      throw error;
    }

    this.recordActivityLog(email, "user", "Password Reset Requested", "Sent password reset link via Supabase Auth");
    return true;
  },

  /**
   * Sign out active user and destroy session.
   */
  async logout() {
    const client = getSupabaseClient();
    if (client) {
      try {
        const user = await this.getAuthenticatedUser();
        if (user) {
          const role = localStorage.getItem(STORAGE_ROLE_KEY) || "user";
          this.recordActivityLog(user.email, role, "Logout", "Session terminated by user");
        }
        await client.auth.signOut();
      } catch (e) {
        console.warn("[SIMPulseAuth] Signout notice:", e);
      }
    }

    localStorage.removeItem(STORAGE_ROLE_KEY);
    window.location.href = "login.html";
  },

  /**
   * Route protection guard for HTML pages.
   * Asynchronously verifies real Supabase session and database role.
   * Direct URL access is strictly protected.
   * @param {Array<string>} allowedRoles List of roles permitted (e.g. ['user', 'admin'] or ['admin'])
   */
  async requireAuth(allowedRoles = ["user", "admin"]) {
    const session = await this.getSession();
    const currentPage = window.location.pathname.split("/").pop() || "index.html";

    // 1. Unauthenticated state
    if (!session || !session.user) {
      if (currentPage !== "login.html") {
        console.warn("[SIMPulseAuth] Unauthenticated access attempt. Redirecting to login.html");
        window.location.href = "login.html";
      }
      return null;
    }

    const user = session.user;

    // Fetch SECURE role from server user record / metadata
    const role = await this.fetchUserSecureRole(user);

    // 2. Authenticated user attempting to view login page -> Redirect to their role dashboard
    if (currentPage === "login.html") {
      if (role === "admin") {
        window.location.href = "admin.html";
      } else {
        window.location.href = "index.html";
      }
      return user;
    }

    // 3. SECURE ROLE GUARD: Check if user has permission to view current page
    if (!allowedRoles.includes(role)) {
      console.warn(`[SIMPulseAuth] SECURE GUARD: Role '${role}' not authorized for '${currentPage}'. Access Denied.`);
      
      // Flash error message on destination page
      sessionStorage.setItem("simpulse_flash_error", "Access Denied: You do not have Administrator permissions.");
      
      window.location.href = "index.html";
      return null;
    }

    return { ...user, role: role };
  },

  /**
   * Helper — Fetch real system profiles for Admin User Management.
   */
  async fetchSystemUsers() {
    const client = getSupabaseClient();
    if (!client) return [];

    try {
      const { data, error } = await client.from("profiles").select("*").order("created_at", { ascending: false });
      if (!error && Array.isArray(data)) {
        return data;
      }
    } catch (e) {
      // Fall back if profiles table is not directly readable by anon client
    }

    return [];
  },

  /**
   * Helper — Record activity log into localStorage for UI/demo inspection.
   * NOTE: Client localStorage activity logs are for local UI inspection and demo monitoring only.
   * They are NOT a secure audit trail. Real audit logging must be enforced server-side.
   */
  recordActivityLog(email, role, eventType, details) {
    const logs = JSON.parse(localStorage.getItem("simpulse_activity_logs") || "[]");
    logs.unshift({
      id: "log-" + Date.now(),
      timestamp: new Date().toISOString(),
      user: email,
      role: role,
      event: eventType,
      details: details,
      ip: "Not captured",
      status: "Success"
    });
    // Retain last 100 entries
    localStorage.setItem("simpulse_activity_logs", JSON.stringify(logs.slice(0, 100)));
  }
};

// Global export
SIMPulseAuth.SUPABASE_URL = SUPABASE_URL;
SIMPulseAuth.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
window.SIMPulseAuth = SIMPulseAuth;
