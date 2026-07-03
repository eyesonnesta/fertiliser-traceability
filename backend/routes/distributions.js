// =====================================================================
// Distribution routes: /api/distributions/...
// =====================================================================

const express = require('express');
const router = express.Router();
const {
  listDistributions,
  issueStock,
} = require('../controllers/distributionController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/', requireAuth, listDistributions);
router.post('/', requireAuth, requireRole('cooperative_official'), issueStock);

module.exports = router;
