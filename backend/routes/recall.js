// =====================================================================
// Recall routes:  /api/recall/...
// =====================================================================

const express = require('express');
const router = express.Router();
const {
  checkExpiry,
  listExpiring,
  listRecalls,
  recallStock,
  updateRecallStatus,
} = require('../controllers/recallController');
const { requireAuth } = require('../middleware/auth');

// Any authenticated role may see alerts for stock visible to them.
router.get('/expiring', requireAuth, listExpiring);
router.get('/', requireAuth, listRecalls);

// Manual expiry check and recall actions still write custody_log entries.
router.post('/check-expiry', requireAuth, checkExpiry);
router.post('/', requireAuth, recallStock);
router.patch('/:id/status', requireAuth, updateRecallStatus);

module.exports = router;
