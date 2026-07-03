// =====================================================================
// Auth controller
// Holds the actual logic for registering a user, logging in, and
// returning the currently logged-in user's details.
// =====================================================================

const crypto = require("crypto");
const db = require("../config/db");
const {
  hashPassword,
  verifyPassword,
  generateToken,
} = require("../utils/auth");
const { validatePasswordPolicy } = require("../utils/passwordPolicy");
const {
  buildPasswordResetLink,
  sendPasswordResetEmail,
} = require("../utils/mailer");

const VALID_ROLES = [
  "national_supplier",
  "depot_manager",
  "cooperative_official",
  "system_administrator",
];
const DEPOT_SCOPED_ROLES = ["depot_manager", "cooperative_official"];
const VALID_DEPOT_SCOPES = ["Nairobi Depot", "Nakuru Depot"];
const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_TTL_MINUTES = 30;
const PASSWORD_RESET_GENERIC_MESSAGE =
  "If that email exists, a reset link has been sent.";

function hashResetToken(token) {
  return crypto.createHash("sha256").update(String(token || ""), "utf8").digest("hex");
}

function normalizeDepotScope(role, value) {
  if (!DEPOT_SCOPED_ROLES.includes(role)) return { value: null };
  const depotScope = String(value || "").trim();
  if (!VALID_DEPOT_SCOPES.includes(depotScope)) {
    return { error: `depot_scope must be one of: ${VALID_DEPOT_SCOPES.join(", ")}.` };
  }
  return { value: depotScope };
}

async function columnExists(conn, tableName, columnName) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName],
  );
  return Number(rows[0]?.count || 0) > 0;
}

function serializeAuthUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    depot_scope: user.depot_scope,
    must_change_password: Boolean(user.must_change_password),
    ...(user.token_version !== undefined
      ? { token_version: Number(user.token_version || 0) }
      : {}),
    ...(user.is_active !== undefined ? { is_active: Boolean(user.is_active) } : {}),
    ...(user.created_at !== undefined ? { created_at: user.created_at } : {}),
  };
}

// POST /api/auth/register
// Creates a new user. Account creation is restricted to the System
// Administrator so role assignment stays controlled.
async function register(req, res) {
  try {
    const { password, confirm_password, role } = req.body;
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const depotScope = normalizeDepotScope(role, req.body.depot_scope);

    // --- Basic validation ---
    if (!name || !email || !password || !role) {
      return res
        .status(400)
        .json({ error: "name, email, password and role are required." });
    }
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: "Invalid role." });
    }
    if (depotScope.error) {
      return res.status(400).json({ error: depotScope.error });
    }
    if (name.length > 120 || email.length > 160) {
      return res.status(400).json({ error: "name or email is too long." });
    }
    if (confirm_password !== undefined && password !== confirm_password) {
      return res.status(400).json({ error: "Passwords do not match." });
    }
    const passwordError = validatePasswordPolicy(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    // --- Reject duplicate emails ---
    const existing = await db.query("SELECT id FROM users WHERE email = ?", [
      email,
    ]);
    if (existing.length > 0) {
      return res
        .status(409)
        .json({ error: "A user with that email already exists." });
    }

    // --- Store the user with a hashed password ---
    const password_hash = await hashPassword(password);
    const result = await db.query(
      `INSERT INTO users
        (name, email, password_hash, role, depot_scope, must_change_password)
       VALUES (?, ?, ?, ?, ?, TRUE)`,
      [name, email, password_hash, role, depotScope.value],
    );

    const user = {
      id: result.insertId,
      name,
      email,
      role,
      depot_scope: depotScope.value,
      must_change_password: true,
    };

    return res.status(201).json({
      message: "User account created.",
      user,
    });
  } catch (err) {
    console.error("register error:", err);
    return res
      .status(500)
      .json({ error: "Something went wrong creating the account." });
  }
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const { password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "email and password are required." });
    }

    const rows = await db.query(
      "SELECT id, name, email, role, depot_scope, must_change_password, password_hash, is_active, token_version FROM users WHERE email = ?",
      [email],
    );
    const user = rows[0];

    // Use the same generic message whether the email or password is wrong,
    // so we don't reveal which emails are registered.
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    if (!user.is_active) {
      return res
        .status(403)
        .json({ error: "This account has been deactivated." });
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const safeUser = serializeAuthUser(user);
    const token = generateToken(safeUser);
    return res.json({ user: safeUser, token });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ error: "Something went wrong logging in." });
  }
}

// PATCH /api/auth/password
// Allows a logged-in user to rotate their own password after verifying
// the current password.
async function changePassword(req, res) {
  try {
    const { current_password, new_password, confirm_password } = req.body;

    if (!current_password || !new_password || !confirm_password) {
      return res.status(400).json({
        error: "current_password, new_password and confirm_password are required.",
      });
    }
    if (new_password !== confirm_password) {
      return res.status(400).json({ error: "Passwords do not match." });
    }
    if (current_password === new_password) {
      return res
        .status(400)
        .json({ error: "New password must be different from the current password." });
    }

    const passwordError = validatePasswordPolicy(new_password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const rows = await db.query(
      "SELECT id, password_hash FROM users WHERE id = ?",
      [req.user.id],
    );
    const user = rows[0];
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const ok = await verifyPassword(current_password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }

    const password_hash = await hashPassword(new_password);
    await db.query(
      `UPDATE users
       SET password_hash = ?,
           token_version = token_version + 1,
           must_change_password = FALSE,
           password_changed_at = NOW()
       WHERE id = ?`,
      [
      password_hash,
      req.user.id,
      ],
    );

    const updatedRows = await db.query(
      "SELECT id, name, email, role, depot_scope, must_change_password, is_active, token_version FROM users WHERE id = ?",
      [req.user.id],
    );
    const updatedUser = serializeAuthUser(updatedRows[0]);
    const token = generateToken(updatedUser);

    return res.json({
      message: "Password changed successfully.",
      user: updatedUser,
      token,
    });
  } catch (err) {
    console.error("changePassword error:", err);
    return res
      .status(500)
      .json({ error: "Something went wrong changing the password." });
  }
}

// POST /api/auth/forgot-password
// Creates a one-time reset token when the email belongs to an active user.
// The response is intentionally generic so account existence is not leaked.
async function forgotPassword(req, res) {
  const email = String(req.body.email || "").trim().toLowerCase();
  const response = { message: PASSWORD_RESET_GENERIC_MESSAGE };

  try {
    if (!email) {
      return res.status(400).json({ error: "email is required." });
    }
    if (email.length > 160) {
      return res.status(400).json({ error: "email is too long." });
    }

    const rows = await db.query(
      "SELECT id, email, is_active FROM users WHERE email = ?",
      [email],
    );
    const user = rows[0];

    if (user?.is_active) {
      const rawToken = crypto.randomBytes(RESET_TOKEN_BYTES).toString("hex");
      const tokenHash = hashResetToken(rawToken);
      const resetLink = buildPasswordResetLink(rawToken);

      const conn = await db.pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query(
          `UPDATE password_reset_tokens
           SET used_at = NOW()
           WHERE user_id = ? AND used_at IS NULL`,
          [user.id],
        );
        await conn.query(
          `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
           VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
          [user.id, tokenHash, RESET_TOKEN_TTL_MINUTES],
        );
        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }

      try {
        await sendPasswordResetEmail({
          to: user.email,
          resetLink,
        });
      } catch (mailErr) {
        console.error("password reset email error:", mailErr);
      }
    }

    return res.json(response);
  } catch (err) {
    console.error("forgotPassword error:", err);
    return res.status(500).json({ error: "Something went wrong requesting a password reset." });
  }
}

// POST /api/auth/reset-password
// Consumes a valid reset token and rotates the user's password inside a
// transaction so token use and password update stay consistent.
async function resetPassword(req, res) {
  const conn = await db.pool.getConnection();
  try {
    const token = String(req.body.token || "").trim();
    const { new_password, confirm_password } = req.body;

    if (!token || !new_password || !confirm_password) {
      return res.status(400).json({
        error: "token, new_password and confirm_password are required.",
      });
    }
    if (token.length > 256) {
      return res.status(400).json({ error: "Reset token is invalid or has expired." });
    }
    if (new_password !== confirm_password) {
      return res.status(400).json({ error: "Passwords do not match." });
    }

    const passwordError = validatePasswordPolicy(new_password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const tokenHash = hashResetToken(token);
    const passwordHash = await hashPassword(new_password);

    await conn.beginTransaction();

    const [tokenRows] = await conn.query(
      `SELECT prt.id, prt.user_id, u.is_active
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token_hash = ?
         AND prt.used_at IS NULL
         AND prt.expires_at > NOW()
       FOR UPDATE`,
      [tokenHash],
    );
    const resetToken = tokenRows[0];

    if (!resetToken || !resetToken.is_active) {
      await conn.rollback();
      return res.status(400).json({ error: "Reset token is invalid or has expired." });
    }

    const hasPasswordChangedAt = await columnExists(conn, "users", "password_changed_at");
    const passwordChangedSql = hasPasswordChangedAt ? ", password_changed_at = NOW()" : "";

    await conn.query(
      `UPDATE users
       SET password_hash = ?,
           token_version = token_version + 1,
           must_change_password = FALSE${passwordChangedSql}
       WHERE id = ?`,
      [passwordHash, resetToken.user_id],
    );
    await conn.query(
      "UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?",
      [resetToken.id],
    );

    await conn.commit();

    return res.json({ message: "Password reset successfully." });
  } catch (err) {
    await conn.rollback();
    console.error("resetPassword error:", err);
    return res.status(500).json({ error: "Something went wrong resetting the password." });
  } finally {
    conn.release();
  }
}

// POST /api/auth/logout  (requires a valid token)
// Rotates the user's token version so every existing JWT for that user expires.
async function logout(req, res) {
  try {
    await db.query(
      "UPDATE users SET token_version = token_version + 1 WHERE id = ?",
      [req.user.id],
    );

    return res.json({ message: "Logged out successfully." });
  } catch (err) {
    console.error("logout error:", err);
    return res.status(500).json({ error: "Something went wrong logging out." });
  }
}

// GET /api/auth/me  (requires a valid token)
// Lets the frontend confirm who is logged in and refresh their details.
async function me(req, res) {
  try {
    const rows = await db.query(
      "SELECT id, name, email, role, depot_scope, must_change_password, is_active, created_at FROM users WHERE id = ?",
      [req.user.id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }
    return res.json({ user: serializeAuthUser(rows[0]) });
  } catch (err) {
    console.error("me error:", err);
    return res.status(500).json({ error: "Something went wrong." });
  }
}

module.exports = {
  register,
  login,
  changePassword,
  forgotPassword,
  resetPassword,
  logout,
  me,
};
