// =====================================================================
// Auth utilities: password hashing + JSON Web Tokens (JWT)
//
// - bcrypt turns a plain password into a one-way hash. You can check a
//   password against the hash, but you can never get the password back.
// - A JWT is a signed token we give the user when they log in. They send
//   it back on every request to prove who they are, so they don't have to
//   send their password each time.
// =====================================================================

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'replace_with_a_long_random_string' || secret.length < 32) {
    throw new Error('JWT_SECRET must be set to a strong random value of at least 32 characters.');
  }
  return secret;
}

// Hash a plain-text password before storing it.
async function hashPassword(plain) {
  const saltRounds = 10; // higher = slower = harder to brute force
  return bcrypt.hash(plain, saltRounds);
}

// Compare a login attempt against the stored hash. Returns true/false.
async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// Create a signed token containing the user's id and role.
function generateToken(user) {
  const payload = {
    id: user.id,
    role: user.role,
    name: user.name,
    depot_scope: user.depot_scope || null,
    must_change_password: Boolean(user.must_change_password),
    token_version: Number(user.token_version || 0),
  };
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
}

// Verify a token sent by the client. Throws if invalid/expired.
function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

module.exports = { hashPassword, verifyPassword, generateToken, verifyToken };
