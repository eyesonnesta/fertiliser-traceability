// =====================================================================
// Auth routes:  /api/auth/...
// =====================================================================

const express = require('express');
const router = express.Router();
const {
  register,
  login,
  changePassword,
  forgotPassword,
  resetPassword,
  logout,
  me,
} = require('../controllers/authController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.post('/register', requireAuth, requireRole('system_administrator'), register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/logout', requireAuth, logout);
router.patch('/password', requireAuth, changePassword);
router.get('/me', requireAuth, me); // protected: needs a valid token

module.exports = router;
