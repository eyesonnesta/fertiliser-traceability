// =====================================================================
// Stock routes:  /api/stock/...
// =====================================================================

const express = require('express');
const router = express.Router();
const {
  registerStock,
  updateStock,
  archiveStock,
  restoreStock,
  listStock,
  getStock,
  getStockQr,
} = require('../controllers/stockController');
const { requireAuth, requireRole } = require('../middleware/auth');

// Only the National Supplier registers new stock.
router.post('/', requireAuth, requireRole('national_supplier'), registerStock);

// Any logged-in user can view stock (filtered by role inside the controller).
router.get('/', requireAuth, listStock);
router.patch('/:id', requireAuth, updateStock);
router.patch('/:id/archive', requireAuth, archiveStock);
router.patch('/:id/restore', requireAuth, restoreStock);
router.get('/:id', requireAuth, getStock);
router.get('/:id/qr', requireAuth, getStockQr);

module.exports = router;
