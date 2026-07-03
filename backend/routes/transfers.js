// =====================================================================
// Transfer routes:  /api/transfers/...
// =====================================================================

const express = require('express');
const router = express.Router();
const {
  listTransfers, listRecipients, dispatch, verify, receive,
} = require('../controllers/transferController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/', requireAuth, listTransfers);

// Populates the dispatch receiver dropdown with the next role in the chain.
router.get(
  '/recipients',
  requireAuth,
  requireRole('national_supplier', 'depot_manager'),
  listRecipients
);

// Suppliers send to depots; depots send onward to cooperatives.
router.post(
  '/dispatch',
  requireAuth,
  requireRole('national_supplier', 'depot_manager'),
  dispatch
);

// Receiving users scan and verify the QR before confirming receipt.
router.post(
  '/verify',
  requireAuth,
  requireRole('depot_manager', 'cooperative_official'),
  verify
);

router.post(
  '/receive',
  requireAuth,
  requireRole('depot_manager', 'cooperative_official'),
  receive
);

module.exports = router;
