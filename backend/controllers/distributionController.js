// =====================================================================
// Distribution controller
// Handles final-mile issue of fertiliser by cooperative officials.
// Farmer registration is outside scope, so recipient details are recorded
// as lightweight issue evidence rather than managed user accounts.
// =====================================================================

const db = require('../config/db');
const { syncStockMovementState } = require('../utils/stockState');

function distributionVisibility(user) {
  if (['system_administrator', 'national_supplier'].includes(user.role)) {
    return { clause: '', params: [] };
  }
  if (user.role === 'cooperative_official') {
    return { clause: 'AND d.cooperative_user_id = ?', params: [user.id] };
  }
  return {
    clause: `AND EXISTS (
      SELECT 1 FROM transfers t
      WHERE t.stock_id = d.stock_id
        AND (t.from_user_id = ? OR t.to_user_id = ?)
    )`,
    params: [user.id, user.id],
  };
}

// GET /api/distributions
async function listDistributions(req, res) {
  try {
    const visibility = distributionVisibility(req.user);
    const rows = await db.query(
      `SELECT d.*, s.batch_number, s.fertiliser_type, s.status,
              u.name AS cooperative_name, u.role AS cooperative_role
       FROM distribution_records d
       JOIN fertiliser_stock s ON s.id = d.stock_id
       JOIN users u ON u.id = d.cooperative_user_id
       WHERE 1 = 1
       ${visibility.clause}
       ORDER BY d.issued_at DESC, d.id DESC
       LIMIT 100`,
      visibility.params
    );
    return res.json({ distributions: rows });
  } catch (err) {
    console.error('listDistributions error:', err);
    return res.status(500).json({ error: 'Could not load distribution records.' });
  }
}

// POST /api/distributions
async function issueStock(req, res) {
  const conn = await db.pool.getConnection();
  let inTransaction = false;

  try {
    const {
      stock_id,
      quantity,
      recipient_name,
      recipient_identifier,
      location,
      notes,
    } = req.body;
    const issueQuantity = Number(quantity);
    const stockId = Number(stock_id);
    const recipientName = String(recipient_name || '').trim();
    const recipientIdentifier = String(recipient_identifier || '').trim();
    const issueLocation = String(location || '').trim();
    const issueNotes = String(notes || '').trim();

    if (!stock_id || !quantity || !recipientName) {
      return res.status(400).json({ error: 'stock_id, quantity and recipient_name are required.' });
    }
    if (
      recipientName.length > 160
      || recipientIdentifier.length > 120
      || issueLocation.length > 160
      || issueNotes.length > 255
    ) {
      return res.status(400).json({ error: 'One or more issue fields exceed the allowed length.' });
    }
    if (!Number.isInteger(stockId) || stockId <= 0) {
      return res.status(400).json({ error: 'stock_id must be a valid stock id.' });
    }
    if (!Number.isInteger(issueQuantity) || issueQuantity <= 0) {
      return res.status(400).json({ error: 'quantity must be a whole number greater than zero.' });
    }

    await conn.beginTransaction();
    inTransaction = true;

    const [stockRows] = await conn.query(
      `SELECT s.*, h.quantity AS held_quantity
       FROM fertiliser_stock s
       JOIN stock_holdings h ON h.stock_id = s.id AND h.user_id = ?
       WHERE s.id = ?
       FOR UPDATE`,
      [req.user.id, stockId]
    );

    if (stockRows.length === 0) {
      await conn.rollback();
      inTransaction = false;
      return res.status(404).json({ error: 'Stock not found in your cooperative holdings.' });
    }

    const stock = stockRows[0];
    if (['expired', 'recalled'].includes(stock.status)) {
      await conn.rollback();
      inTransaction = false;
      return res.status(409).json({ error: `This batch cannot be issued because it is ${stock.status}.` });
    }

    const heldQuantity = Number(stock.held_quantity || 0);
    if (issueQuantity > heldQuantity) {
      await conn.rollback();
      inTransaction = false;
      return res.status(400).json({ error: `You only have ${heldQuantity} bag(s) available to issue.` });
    }

    const [result] = await conn.query(
      `INSERT INTO distribution_records
        (stock_id, cooperative_user_id, recipient_name, recipient_identifier,
         location, quantity, notes, issued_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        stock.id,
        req.user.id,
        recipientName,
        recipientIdentifier || null,
        issueLocation || null,
        issueQuantity,
        issueNotes || null,
      ]
    );

    await conn.query(
      `UPDATE stock_holdings
       SET quantity = quantity - ?
       WHERE stock_id = ? AND user_id = ?`,
      [issueQuantity, stock.id, req.user.id]
    );

    await syncStockMovementState(conn, stock.id);

    await conn.query(
      'INSERT INTO custody_log (stock_id, user_id, action, notes) VALUES (?, ?, ?, ?)',
      [
        stock.id,
        req.user.id,
        'issued',
        `${issueQuantity} bag(s) from batch ${stock.batch_number} issued to ${recipientName}.`,
      ]
    );

    await conn.commit();
    inTransaction = false;

    return res.status(201).json({
      message: 'Stock issued successfully.',
      distribution_id: result.insertId,
      stock_id: stock.id,
      batch_number: stock.batch_number,
      quantity: issueQuantity,
      recipient_name: recipientName,
    });
  } catch (err) {
    if (inTransaction) {
      await conn.rollback();
    }
    console.error('issueStock error:', err);
    return res.status(500).json({ error: 'Could not issue stock.' });
  } finally {
    conn.release();
  }
}

module.exports = { listDistributions, issueStock };
