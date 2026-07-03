// =====================================================================
// Report routes: /api/reports/...
// =====================================================================

const express = require('express');
const router = express.Router();
const {
  getSummary,
  listCustodyReport,
  exportCustodyCsv,
} = require('../controllers/reportController');
const { requireAuth } = require('../middleware/auth');

router.get('/summary', requireAuth, getSummary);
router.get('/custody', requireAuth, listCustodyReport);
router.get('/custody.csv', requireAuth, exportCustodyCsv);

module.exports = router;
