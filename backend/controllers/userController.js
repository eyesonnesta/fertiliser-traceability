// =====================================================================
// User controller
// Admin-only account management for the prototype.
//
// The System Administrator creates accounts and can deactivate users
// without deleting audit history linked to those users.
// =====================================================================

const db = require('../config/db');
const { hashPassword } = require('../utils/auth');
const { validatePasswordPolicy } = require('../utils/passwordPolicy');

const VALID_ROLES = [
  'national_supplier',
  'depot_manager',
  'cooperative_official',
  'system_administrator',
];

const DEPOT_SCOPED_ROLES = ['depot_manager', 'cooperative_official'];
const VALID_DEPOT_SCOPES = ['Nairobi Depot', 'Nakuru Depot'];

function normalizeDepotScope(role, value) {
  if (!DEPOT_SCOPED_ROLES.includes(role)) return { value: null };
  const depotScope = String(value || '').trim();
  if (!VALID_DEPOT_SCOPES.includes(depotScope)) {
    return { error: `depot_scope must be one of: ${VALID_DEPOT_SCOPES.join(', ')}.` };
  }
  return { value: depotScope };
}

function serializeUser(user) {
  return {
    ...user,
    is_active: Boolean(user.is_active),
    must_change_password: Boolean(user.must_change_password),
  };
}

// GET /api/users
async function listUsers(req, res) {
  try {
    const users = await db.query(
      `SELECT id, name, email, role, depot_scope, is_active, must_change_password, created_at
       FROM users
       ORDER BY created_at DESC, id DESC`
    );
    return res.json({ users: users.map(serializeUser) });
  } catch (err) {
    console.error('listUsers error:', err);
    return res.status(500).json({ error: 'Could not load users.' });
  }
}

// POST /api/users
async function createUser(req, res) {
  try {
    const { password, confirm_password, role } = req.body;
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const depotScope = normalizeDepotScope(role, req.body.depot_scope);

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'name, email, password and role are required.' });
    }
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }
    if (depotScope.error) {
      return res.status(400).json({ error: depotScope.error });
    }
    if (name.length > 120 || email.length > 160) {
      return res.status(400).json({ error: 'name or email is too long.' });
    }
    if (confirm_password !== undefined && password !== confirm_password) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }
    const passwordError = validatePasswordPolicy(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const existing = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'A user with that email already exists.' });
    }

    const passwordHash = await hashPassword(password);
    const result = await db.query(
      `INSERT INTO users
        (name, email, password_hash, role, depot_scope, must_change_password)
       VALUES (?, ?, ?, ?, ?, TRUE)`,
      [name, email, passwordHash, role, depotScope.value]
    );

    return res.status(201).json({
      message: 'User account created.',
      user: serializeUser({
        id: result.insertId,
        name,
        email,
        role,
        depot_scope: depotScope.value,
        is_active: true,
        must_change_password: true,
      }),
    });
  } catch (err) {
    console.error('createUser error:', err);
    return res.status(500).json({ error: 'Could not create user.' });
  }
}

// PATCH /api/users/:id/password
async function resetUserPassword(req, res) {
  try {
    const { id } = req.params;
    const { password, confirm_password } = req.body;
    const userId = Number(id);

    if (!password || !confirm_password) {
      return res.status(400).json({ error: 'password and confirm_password are required.' });
    }
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'User id must be valid.' });
    }
    if (password !== confirm_password) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }
    const passwordError = validatePasswordPolicy(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const existing = await db.query(
      'SELECT id, name, email, role, depot_scope, is_active, must_change_password, created_at FROM users WHERE id = ?',
      [userId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const passwordHash = await hashPassword(password);
    await db.query(
      `UPDATE users
       SET password_hash = ?,
           token_version = token_version + 1,
           must_change_password = TRUE,
           password_changed_at = NOW()
       WHERE id = ?`,
      [passwordHash, userId]
    );

    return res.json({
      message: `Password reset for ${existing[0].name}.`,
      user: serializeUser(existing[0]),
    });
  } catch (err) {
    console.error('resetUserPassword error:', err);
    return res.status(500).json({ error: 'Could not reset user password.' });
  }
}

// PATCH /api/users/:id/status
async function updateUserStatus(req, res) {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    const userId = Number(id);

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active must be true or false.' });
    }
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'User id must be valid.' });
    }
    if (userId === Number(req.user.id) && !is_active) {
      return res.status(400).json({ error: 'You cannot deactivate your own admin account.' });
    }

    const existing = await db.query(
      'SELECT id, name, email, role, depot_scope, is_active, must_change_password, created_at FROM users WHERE id = ?',
      [userId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    await db.query(
      'UPDATE users SET is_active = ?, token_version = token_version + 1 WHERE id = ?',
      [is_active, userId]
    );

    return res.json({
      message: is_active ? 'User activated.' : 'User deactivated.',
      user: serializeUser({
        ...existing[0],
        is_active,
      }),
    });
  } catch (err) {
    console.error('updateUserStatus error:', err);
    return res.status(500).json({ error: 'Could not update user status.' });
  }
}

module.exports = { listUsers, createUser, resetUserPassword, updateUserStatus };
