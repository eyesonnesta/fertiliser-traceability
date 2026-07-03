// =====================================================================
// User routes:  /api/users/...
// =====================================================================

const express = require('express');
const router = express.Router();
const {
  listUsers,
  createUser,
  resetUserPassword,
  updateUserStatus,
} = require('../controllers/userController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth, requireRole('system_administrator'));

router.get('/', listUsers);
router.post('/', createUser);
router.patch('/:id/password', resetUserPassword);
router.patch('/:id/status', updateUserStatus);

module.exports = router;
