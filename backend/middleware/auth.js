// =====================================================================
// Authentication & authorisation middleware
//
// "Middleware" is a function that runs BEFORE a route handler. We use it
// to protect routes:
//   - requireAuth: the request must carry a valid login token.
//   - requireRole: the logged-in user must have one of the allowed roles.
//
// On success we attach the decoded user to req.user so the route handler
// knows who is making the request.
// =====================================================================

const { verifyToken } = require('../utils/auth');
const db = require('../config/db');

// Blocks the request unless a valid token is present.
async function requireAuth(req, res, next) {
  // Tokens arrive in the header:  Authorization: Bearer <token>
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const decoded = verifyToken(token); // { id, role, name, token_version }
    const rows = await db.query(
      'SELECT id, name, email, role, depot_scope, is_active, token_version, must_change_password FROM users WHERE id = ?',
      [decoded.id]
    );
    const user = rows[0];
    if (!user || !user.is_active) {
      return res.status(403).json({ error: 'This account has been deactivated.' });
    }
    if (Number(decoded.token_version) !== Number(user.token_version || 0)) {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }
    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      depot_scope: user.depot_scope,
      must_change_password: Boolean(user.must_change_password),
    };
    next(); // token is valid, continue to the route
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// Returns a middleware that only allows the listed roles through.
// Usage:  router.post('/stock', requireAuth, requireRole('national_supplier'), handler)
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission for this action.' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
