// =====================================================================
// Recall controller
// Handles Week 3 expiry checks and recall recording.
//
// Expiry is system-detected from the expiry_date column. Recall is a
// human decision with a reason, so it also writes into recall_records.
// Both paths append custody_log rows so the audit trail stays complete.
// =====================================================================

const db = require('../config/db');

const EXPIRY_WINDOW_DAYS = 30;
const RECALL_STATUSES = ['pending', 'in_review', 'resolved', 'rejected'];
const RECALL_STATUS_ROLES = ['system_administrator', 'cooperative_official'];

function canManageStock(user, stock) {
  if (['system_administrator', 'national_supplier'].includes(user.role)) {
    return true;
  }
  return Number(stock.current_holder_id) === Number(user.id);
}

function stockVisibilityClause(user) {
  if (['system_administrator', 'national_supplier'].includes(user.role)) {
    return { clause: '', params: [] };
  }
  return { clause: 'AND s.current_holder_id = ?', params: [user.id] };
}

function canUpdateRecallStatus(user, stock) {
  if (user.role === 'system_administrator') {
    return true;
  }
  return user.role === 'cooperative_official'
    && Number(stock.current_holder_id) === Number(user.id);
}

async function markExpiredStock(conn, user) {
  const visibility = stockVisibilityClause(user);
  const [expiredRows] = await conn.query(
    `SELECT s.id, s.batch_number
     FROM fertiliser_stock s
     WHERE s.expiry_date < CURDATE()
       AND s.status NOT IN ('expired', 'recalled')
       ${visibility.clause}
     FOR UPDATE`,
    visibility.params
  );

  if (expiredRows.length === 0) {
    return [];
  }

  const expiredIds = expiredRows.map((row) => row.id);
  await conn.query(
    "UPDATE fertiliser_stock SET status = 'expired' WHERE id IN (?)",
    [expiredIds]
  );

  for (const stock of expiredRows) {
    await conn.query(
      'INSERT INTO custody_log (stock_id, user_id, action, notes) VALUES (?, ?, ?, ?)',
      [
        stock.id,
        user.id,
        'expired',
        `Batch ${stock.batch_number} automatically flagged as expired.`,
      ]
    );
  }

  return expiredRows;
}

// POST /api/recall/check-expiry
// Runs the expiry check immediately and records any newly expired batches.
async function checkExpiry(req, res) {
  const conn = await db.pool.getConnection();
  try {
    await conn.beginTransaction();
    const newlyExpired = await markExpiredStock(conn, req.user);
    await conn.commit();

    return res.json({
      message: 'Expiry check completed.',
      updated_count: newlyExpired.length,
      newly_expired: newlyExpired,
    });
  } catch (err) {
    await conn.rollback();
    console.error('checkExpiry error:', err);
    return res.status(500).json({ error: 'Could not check stock expiry.' });
  } finally {
    conn.release();
  }
}

// GET /api/recall/expiring
// Returns expired stock plus stock approaching expiry. It also runs the
// expiry check first so the dashboard reflects today's real status.
async function listExpiring(req, res) {
  const conn = await db.pool.getConnection();
  try {
    await conn.beginTransaction();
    const newlyExpired = await markExpiredStock(conn, req.user);
    await conn.commit();

    const visibility = stockVisibilityClause(req.user);
    const expired = await db.query(
      `SELECT s.*, u.name AS holder_name, u.role AS holder_role
       FROM fertiliser_stock s
       LEFT JOIN users u ON u.id = s.current_holder_id
       WHERE s.status = 'expired'
       ${visibility.clause}
       ORDER BY s.expiry_date ASC`,
      visibility.params
    );

    const expiringSoon = await db.query(
      `SELECT s.*, u.name AS holder_name, u.role AS holder_role
       FROM fertiliser_stock s
       LEFT JOIN users u ON u.id = s.current_holder_id
       WHERE s.expiry_date >= CURDATE()
         AND s.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
         AND s.status NOT IN ('expired', 'recalled')
       ${visibility.clause}
       ORDER BY s.expiry_date ASC`,
      [EXPIRY_WINDOW_DAYS, ...visibility.params]
    );

    return res.json({
      window_days: EXPIRY_WINDOW_DAYS,
      newly_expired_count: newlyExpired.length,
      expired,
      expiring_soon: expiringSoon,
    });
  } catch (err) {
    await conn.rollback();
    console.error('listExpiring error:', err);
    return res.status(500).json({ error: 'Could not load expiry alerts.' });
  } finally {
    conn.release();
  }
}

// GET /api/recall
// Lists recorded recalls with the batch and user who flagged them.
async function listRecalls(req, res) {
  try {
    const visibility = stockVisibilityClause(req.user);
    const recalls = await db.query(
      `SELECT r.id, r.stock_id, r.reason, r.flagged_at,
              r.status AS recall_status, r.status_notes,
              r.status_updated_by, r.status_updated_at,
              s.batch_number, s.fertiliser_type, s.quantity, s.status,
              s.expiry_date, s.current_holder_id,
              holder.name AS holder_name, holder.role AS holder_role,
              flagged.name AS flagged_by_name, flagged.role AS flagged_by_role,
              updater.name AS status_updated_by_name,
              updater.role AS status_updated_by_role
       FROM recall_records r
       JOIN fertiliser_stock s ON s.id = r.stock_id
       LEFT JOIN users holder ON holder.id = s.current_holder_id
       JOIN users flagged ON flagged.id = r.flagged_by
       LEFT JOIN users updater ON updater.id = r.status_updated_by
       WHERE 1 = 1
       ${visibility.clause}
       ORDER BY r.flagged_at DESC`,
      visibility.params
    );

    return res.json({ recalls });
  } catch (err) {
    console.error('listRecalls error:', err);
    return res.status(500).json({ error: 'Could not load recall records.' });
  }
}

// POST /api/recall
// Flags a damaged, expired, or otherwise unsafe batch for recall.
async function recallStock(req, res) {
  const conn = await db.pool.getConnection();
  try {
    const { stock_id } = req.body;
    const reason = String(req.body.reason || '').trim();
    if (!stock_id || !reason) {
      return res.status(400).json({ error: 'stock_id and reason are required.' });
    }
    if (reason.length > 255) {
      return res.status(400).json({ error: 'reason must be 255 characters or less.' });
    }

    await conn.beginTransaction();

    const [stockRows] = await conn.query(
      `SELECT s.*, u.name AS holder_name, u.role AS holder_role
       FROM fertiliser_stock s
       LEFT JOIN users u ON u.id = s.current_holder_id
       WHERE s.id = ?
       FOR UPDATE`,
      [stock_id]
    );

    if (stockRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Stock not found.' });
    }

    const stock = stockRows[0];
    if (!canManageStock(req.user, stock)) {
      await conn.rollback();
      return res.status(403).json({ error: 'You can only recall stock you are allowed to manage.' });
    }
    if (stock.status === 'recalled') {
      await conn.rollback();
      return res.status(409).json({ error: 'This batch is already recalled.' });
    }

    const [recallResult] = await conn.query(
      'INSERT INTO recall_records (stock_id, reason, flagged_by) VALUES (?, ?, ?)',
      [stock.id, reason, req.user.id]
    );

    await conn.query(
      "UPDATE fertiliser_stock SET status = 'recalled' WHERE id = ?",
      [stock.id]
    );

    await conn.query(
      'INSERT INTO custody_log (stock_id, user_id, action, notes) VALUES (?, ?, ?, ?)',
      [
        stock.id,
        req.user.id,
        'recalled',
        `Batch ${stock.batch_number} recalled. Reason: ${reason}`,
      ]
    );

    await conn.commit();

    return res.status(201).json({
      message: 'Stock recalled successfully.',
      recall_id: recallResult.insertId,
      stock_id: stock.id,
      batch_number: stock.batch_number,
      recall_status: 'pending',
    });
  } catch (err) {
    await conn.rollback();
    console.error('recallStock error:', err);
    return res.status(500).json({ error: 'Could not recall stock.' });
  } finally {
    conn.release();
  }
}

// PATCH /api/recall/:id/status
// Updates the recall lifecycle without changing the stock custody state.
async function updateRecallStatus(req, res) {
  const conn = await db.pool.getConnection();
  try {
    const recallId = Number(req.params.id);
    const status = String(req.body.status || '').trim();
    const notes = String(req.body.notes || req.body.comment || '').trim();

    if (!Number.isInteger(recallId) || recallId <= 0) {
      return res.status(400).json({ error: 'Recall id must be valid.' });
    }
    if (!RECALL_STATUS_ROLES.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to update recall status.' });
    }
    if (!RECALL_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid recall status.' });
    }
    if (!notes) {
      return res.status(400).json({ error: 'notes are required.' });
    }
    if (notes.length > 255) {
      return res.status(400).json({ error: 'notes must be 255 characters or less.' });
    }

    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT r.id, r.stock_id, r.status AS recall_status,
              s.batch_number, s.status AS stock_status, s.current_holder_id
       FROM recall_records r
       JOIN fertiliser_stock s ON s.id = r.stock_id
       WHERE r.id = ?
       FOR UPDATE`,
      [recallId]
    );

    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Recall record not found.' });
    }

    const recall = rows[0];
    if (!canUpdateRecallStatus(req.user, recall)) {
      await conn.rollback();
      return res.status(403).json({ error: 'You can only update recall status for stock you manage.' });
    }

    await conn.query(
      `UPDATE recall_records
       SET status = ?, status_notes = ?, status_updated_by = ?, status_updated_at = NOW()
       WHERE id = ?`,
      [status, notes, req.user.id, recall.id]
    );

    await conn.query(
      'INSERT INTO custody_log (stock_id, user_id, action, notes) VALUES (?, ?, ?, ?)',
      [
        recall.stock_id,
        req.user.id,
        'recall_status_updated',
        `Recall #${recall.id} status changed from ${recall.recall_status} to ${status}. Notes: ${notes}`,
      ]
    );

    const [updatedRows] = await conn.query(
      `SELECT r.id, r.stock_id, r.reason, r.flagged_at,
              r.status AS recall_status, r.status_notes,
              r.status_updated_by, r.status_updated_at,
              s.batch_number, s.fertiliser_type, s.quantity, s.status,
              s.expiry_date, s.current_holder_id,
              holder.name AS holder_name, holder.role AS holder_role,
              flagged.name AS flagged_by_name, flagged.role AS flagged_by_role,
              updater.name AS status_updated_by_name,
              updater.role AS status_updated_by_role
       FROM recall_records r
       JOIN fertiliser_stock s ON s.id = r.stock_id
       LEFT JOIN users holder ON holder.id = s.current_holder_id
       JOIN users flagged ON flagged.id = r.flagged_by
       LEFT JOIN users updater ON updater.id = r.status_updated_by
       WHERE r.id = ?`,
      [recall.id]
    );

    await conn.commit();

    return res.json({
      message: 'Recall status updated.',
      recall: updatedRows[0],
    });
  } catch (err) {
    await conn.rollback();
    console.error('updateRecallStatus error:', err);
    return res.status(500).json({ error: 'Could not update recall status.' });
  } finally {
    conn.release();
  }
}

module.exports = {
  checkExpiry,
  listExpiring,
  listRecalls,
  recallStock,
  updateRecallStatus,
};
