// =====================================================================
// Transfer controller
// Handles Week 2 movement: dispatch, QR verification, and receipt.
//
// The important rule is that stock movement is recorded in two places:
//   1. transfers stores the operational dispatch/receipt record
//   2. custody_log gets an append-only event for the audit trail
// =====================================================================

const db = require('../config/db');
const { syncStockMovementState } = require('../utils/stockState');
const { normalizeDemoDepot } = require('../utils/demoDepots');

const NEXT_ROLE_BY_DISPATCHER = {
  national_supplier: 'depot_manager',
  depot_manager: 'cooperative_official',
};

const DEMO_DEPOT_SCOPES = ['Nairobi Depot', 'Nakuru Depot'];

function buildRecipientQuery(user, expectedRole) {
  const params = [expectedRole];
  const whereClauses = ['role = ?', 'is_active = TRUE'];

  if (user.role === 'depot_manager') {
    const depotScope = normalizeDemoDepot(user.depot_scope);
    if (!depotScope) {
      return { error: 'Your depot manager account is not assigned to a depot.' };
    }
    whereClauses.push('depot_scope = ?');
    params.push(depotScope);
  } else if (user.role === 'national_supplier' && expectedRole === 'depot_manager') {
    whereClauses.push('depot_scope IN (?, ?)');
    params.push(...DEMO_DEPOT_SCOPES);
  }

  return {
    sql: `SELECT id, name, email, role, depot_scope
       FROM users
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY name ASC`,
    params,
  };
}

function validateDispatchTarget(dispatcher, stock, targetUser) {
  if (dispatcher.role === 'national_supplier') {
    const stockDestination = normalizeDemoDepot(stock.destination);
    const targetDepot = normalizeDemoDepot(targetUser.depot_scope);
    if (!targetDepot) {
      return { error: 'The selected depot manager is not assigned to a depot.' };
    }
    if (stockDestination && targetDepot !== stockDestination) {
      return {
        error: `This batch is registered for ${stockDestination}. Select the ${stockDestination} manager.`,
      };
    }
  }

  if (dispatcher.role === 'depot_manager') {
    const dispatcherDepot = normalizeDemoDepot(dispatcher.depot_scope);
    const targetDepot = normalizeDemoDepot(targetUser.depot_scope);
    if (!dispatcherDepot) {
      return { error: 'Your depot manager account is not assigned to a depot.' };
    }
    if (!targetDepot) {
      return { error: 'The selected cooperative official is not assigned under a depot.' };
    }
    if (dispatcherDepot !== targetDepot) {
      return {
        error: `You can only dispatch to cooperative officials under ${dispatcherDepot}.`,
      };
    }
  }

  return { valid: true };
}

// GET /api/transfers/recipients
// Returns the active users a dispatcher is allowed to send stock to.
async function listRecipients(req, res) {
  try {
    const expectedRole = NEXT_ROLE_BY_DISPATCHER[req.user.role];
    if (!expectedRole) {
      return res.status(400).json({ error: 'This role cannot dispatch stock.' });
    }

    const recipientQuery = buildRecipientQuery(req.user, expectedRole);
    if (recipientQuery.error) {
      return res.status(400).json({ error: recipientQuery.error });
    }

    const users = await db.query(recipientQuery.sql, recipientQuery.params);

    return res.json({ users });
  } catch (err) {
    console.error('list transfer recipients error:', err);
    return res.status(500).json({ error: 'Could not load transfer recipients.' });
  }
}

// GET /api/transfers
// Lists movement records visible to the current user.
async function listTransfers(req, res) {
  try {
    const canSeeAll = ['system_administrator', 'national_supplier'].includes(req.user.role);
    const visibilityClause = canSeeAll ? '' : 'AND (t.from_user_id = ? OR t.to_user_id = ?)';
    const visibilityParams = canSeeAll ? [] : [req.user.id, req.user.id];

    const transfers = await db.query(
      `SELECT
         t.id, t.stock_id, t.from_user_id, t.to_user_id, t.quantity, t.dispatched_at, t.received_at,
         t.delivery_condition, t.status,
         s.batch_number, s.fertiliser_type, s.status AS stock_status,
         from_u.name AS from_user_name, from_u.role AS from_user_role,
         to_u.name AS to_user_name, to_u.role AS to_user_role
       FROM transfers t
       JOIN fertiliser_stock s ON s.id = t.stock_id
       JOIN users from_u ON from_u.id = t.from_user_id
       JOIN users to_u ON to_u.id = t.to_user_id
       WHERE 1 = 1
       ${visibilityClause}
       ORDER BY
         CASE t.status WHEN 'dispatched' THEN 0 ELSE 1 END,
         COALESCE(t.received_at, t.dispatched_at) DESC,
         t.id DESC
       LIMIT 100`,
      visibilityParams
    );

    return res.json({ transfers });
  } catch (err) {
    console.error('listTransfers error:', err);
    return res.status(500).json({ error: 'Could not load transfers.' });
  }
}

// POST /api/transfers/dispatch
// A supplier dispatches to a depot; a depot dispatches to a cooperative.
async function dispatch(req, res) {
  const conn = await db.pool.getConnection();
  let inTransaction = false;

  try {
    const { stock_id, to_user_id, quantity } = req.body;
    const dispatchQuantity = Number(quantity);
    const stockId = Number(stock_id);
    const toUserId = Number(to_user_id);

    if (!stock_id || !to_user_id || quantity === undefined || quantity === null || quantity === '') {
      return res.status(400).json({ error: 'stock_id, to_user_id and quantity are required.' });
    }
    if (!Number.isInteger(stockId) || stockId <= 0 || !Number.isInteger(toUserId) || toUserId <= 0) {
      return res.status(400).json({ error: 'stock_id and to_user_id must be valid ids.' });
    }
    if (!Number.isInteger(dispatchQuantity) || dispatchQuantity <= 0) {
      return res.status(400).json({ error: 'quantity must be a whole number greater than zero.' });
    }

    await conn.beginTransaction();
    inTransaction = true;

    // Lock the stock row while we check its current state and create the transfer.
    const [stockRows] = await conn.query(
      `SELECT s.*, u.name AS holder_name, u.role AS holder_role
       FROM fertiliser_stock s
       LEFT JOIN users u ON u.id = s.current_holder_id
      WHERE s.id = ?
       FOR UPDATE`,
      [stockId]
    );

    if (stockRows.length === 0) {
      await conn.rollback();
      inTransaction = false;
      return res.status(404).json({ error: 'Stock not found.' });
    }

    const stock = stockRows[0];
    if (['expired', 'recalled'].includes(stock.status)) {
      await conn.rollback();
      inTransaction = false;
      return res.status(409).json({ error: `This batch cannot be dispatched because it is ${stock.status}.` });
    }

    const [holdingRows] = await conn.query(
      `SELECT quantity
       FROM stock_holdings
       WHERE stock_id = ? AND user_id = ?
       FOR UPDATE`,
      [stock.id, req.user.id]
    );
    const heldQuantity = Number(holdingRows[0]?.quantity || 0);
    if (heldQuantity <= 0) {
      await conn.rollback();
      inTransaction = false;
      return res.status(403).json({ error: 'You can only dispatch stock you currently hold.' });
    }
    if (dispatchQuantity > heldQuantity) {
      await conn.rollback();
      inTransaction = false;
      return res.status(400).json({
        error: `You only have ${heldQuantity} bag(s) available to dispatch.`,
      });
    }

    const expectedRole = NEXT_ROLE_BY_DISPATCHER[req.user.role];
    const [targetRows] = await conn.query(
      'SELECT id, name, email, role, depot_scope, is_active FROM users WHERE id = ?',
      [toUserId]
    );

    if (targetRows.length === 0) {
      await conn.rollback();
      inTransaction = false;
      return res.status(404).json({ error: 'Receiving user not found.' });
    }

    const targetUser = targetRows[0];
    if (!targetUser.is_active) {
      await conn.rollback();
      inTransaction = false;
      return res.status(409).json({ error: 'The receiving user account is inactive.' });
    }
    if (targetUser.role !== expectedRole) {
      await conn.rollback();
      inTransaction = false;
      return res.status(400).json({
        error: `A ${req.user.role} can only dispatch to a ${expectedRole}.`,
      });
    }
    if (Number(targetUser.id) === Number(req.user.id)) {
      await conn.rollback();
      inTransaction = false;
      return res.status(400).json({ error: 'You cannot dispatch stock to yourself.' });
    }

    const routeValidation = validateDispatchTarget(req.user, stock, targetUser);
    if (routeValidation.error) {
      await conn.rollback();
      inTransaction = false;
      return res.status(400).json({ error: routeValidation.error });
    }

    const [transferResult] = await conn.query(
      `INSERT INTO transfers
        (stock_id, from_user_id, to_user_id, quantity, dispatched_at, status)
       VALUES (?, ?, ?, ?, NOW(), 'dispatched')`,
      [stock.id, req.user.id, targetUser.id, dispatchQuantity]
    );

    await conn.query(
      `UPDATE stock_holdings
       SET quantity = quantity - ?
       WHERE stock_id = ? AND user_id = ?`,
      [dispatchQuantity, stock.id, req.user.id]
    );

    await syncStockMovementState(conn, stock.id);

    await conn.query(
      'INSERT INTO custody_log (stock_id, user_id, action, notes) VALUES (?, ?, ?, ?)',
      [
        stock.id,
        req.user.id,
        'dispatched',
        `${dispatchQuantity} bag(s) from batch ${stock.batch_number} dispatched to ${targetUser.name}.`,
      ]
    );

    await conn.commit();
    inTransaction = false;

    return res.status(201).json({
      message: 'Stock dispatched successfully.',
      transfer_id: transferResult.insertId,
      stock_id: stock.id,
      quantity: dispatchQuantity,
      to_user: {
        id: targetUser.id,
        name: targetUser.name,
        role: targetUser.role,
        depot_scope: targetUser.depot_scope,
      },
    });
  } catch (err) {
    if (inTransaction) {
      await conn.rollback();
    }
    console.error('dispatch transfer error:', err);
    return res.status(500).json({ error: 'Could not dispatch stock.' });
  } finally {
    conn.release();
  }
}

// POST /api/transfers/verify
// Looks up the scanned QR payload and confirms there is a pending transfer
// for the logged-in receiver. It does not update the database.
async function verify(req, res) {
  try {
    const { qr_payload } = req.body;
    if (!qr_payload) {
      return res.status(400).json({ error: 'qr_payload is required.' });
    }

    const stockRows = await db.query(
      `SELECT s.*, q.qr_payload, u.name AS holder_name, u.role AS holder_role
       FROM qr_codes q
       JOIN fertiliser_stock s ON s.id = q.stock_id
       LEFT JOIN users u ON u.id = s.current_holder_id
       WHERE q.qr_payload = ?`,
      [qr_payload]
    );

    if (stockRows.length === 0) {
      return res.status(404).json({ error: 'Unknown QR code.' });
    }

    const stock = stockRows[0];
    if (stock.status === 'recalled') {
      return res.status(409).json({ error: 'This batch has been recalled and cannot be received.' });
    }
    if (stock.status === 'expired') {
      return res.status(409).json({ error: 'This batch is expired and cannot be received.' });
    }
    const transferRows = await db.query(
      `SELECT t.id, t.stock_id, t.from_user_id, t.to_user_id, t.dispatched_at,
              t.quantity,
              from_u.name AS from_user_name, from_u.role AS from_user_role,
              to_u.name AS to_user_name, to_u.role AS to_user_role
       FROM transfers t
       JOIN users from_u ON from_u.id = t.from_user_id
       JOIN users to_u ON to_u.id = t.to_user_id
       WHERE t.stock_id = ? AND t.status = 'dispatched' AND t.to_user_id = ?
       ORDER BY t.dispatched_at DESC
       LIMIT 1`,
      [stock.id, req.user.id]
    );

    if (transferRows.length === 0) {
      return res.status(409).json({ error: 'No open dispatch was found for you on this batch.' });
    }

    const transfer = transferRows[0];
    return res.json({
      message: 'QR code verified. Confirm receipt to complete the transfer.',
      stock,
      transfer,
    });
  } catch (err) {
    console.error('verify transfer error:', err);
    return res.status(500).json({ error: 'Could not verify QR code.' });
  }
}

// POST /api/transfers/receive
// Completes the pending transfer after a successful scan/verification.
async function receive(req, res) {
  const conn = await db.pool.getConnection();
  let inTransaction = false;

  try {
    const { qr_payload, transfer_id } = req.body;
    const deliveryCondition = String(req.body.delivery_condition || '').trim();

    if (!qr_payload) {
      return res.status(400).json({ error: 'qr_payload is required.' });
    }
    if (!deliveryCondition) {
      return res.status(400).json({ error: 'delivery_condition is required.' });
    }
    if (deliveryCondition.length > 160) {
      return res.status(400).json({ error: 'delivery_condition must be 160 characters or less.' });
    }

    await conn.beginTransaction();
    inTransaction = true;

    const params = transfer_id ? [transfer_id, qr_payload] : [qr_payload];
    const filter = transfer_id ? 't.id = ? AND q.qr_payload = ?' : 'q.qr_payload = ?';
    const [transferRows] = await conn.query(
      `SELECT t.id, t.stock_id, t.from_user_id, t.to_user_id, t.status AS transfer_status,
              t.quantity,
              s.batch_number, s.status AS stock_status,
              q.qr_payload,
              from_u.name AS from_user_name,
              to_u.name AS to_user_name, to_u.role AS to_user_role
       FROM transfers t
       JOIN fertiliser_stock s ON s.id = t.stock_id
       JOIN qr_codes q ON q.stock_id = s.id
       JOIN users from_u ON from_u.id = t.from_user_id
       JOIN users to_u ON to_u.id = t.to_user_id
       WHERE ${filter} AND t.status = 'dispatched'
       ORDER BY t.dispatched_at DESC
       LIMIT 1
       FOR UPDATE`,
      params
    );

    if (transferRows.length === 0) {
      await conn.rollback();
      inTransaction = false;
      return res.status(404).json({ error: 'Pending dispatched transfer not found for this QR payload.' });
    }

    const transfer = transferRows[0];
    if (Number(transfer.to_user_id) !== Number(req.user.id)) {
      await conn.rollback();
      inTransaction = false;
      return res.status(403).json({ error: 'You can only receive transfers addressed to you.' });
    }
    if (transfer.stock_status === 'recalled') {
      await conn.rollback();
      inTransaction = false;
      return res.status(409).json({ error: 'This batch has been recalled and cannot be received.' });
    }
    if (transfer.stock_status === 'expired') {
      await conn.rollback();
      inTransaction = false;
      return res.status(409).json({ error: 'This batch is expired and cannot be received.' });
    }
    await conn.query(
      `UPDATE transfers
       SET status = 'received', received_at = NOW(), delivery_condition = ?
       WHERE id = ?`,
      [deliveryCondition, transfer.id]
    );

    await conn.query(
      `INSERT INTO stock_holdings (stock_id, user_id, quantity)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
      [transfer.stock_id, req.user.id, transfer.quantity]
    );

    await syncStockMovementState(conn, transfer.stock_id);

    await conn.query(
      'INSERT INTO custody_log (stock_id, user_id, action, notes) VALUES (?, ?, ?, ?)',
      [
        transfer.stock_id,
        req.user.id,
        'received',
        `${transfer.quantity} bag(s) from batch ${transfer.batch_number} received from ${transfer.from_user_name}. Condition: ${deliveryCondition}.`,
      ]
    );

    await conn.commit();
    inTransaction = false;

    return res.json({
      message: 'Stock received successfully.',
      transfer_id: transfer.id,
      stock_id: transfer.stock_id,
      quantity: transfer.quantity,
      received_by: {
        id: req.user.id,
        name: transfer.to_user_name,
        role: transfer.to_user_role,
      },
    });
  } catch (err) {
    if (inTransaction) {
      await conn.rollback();
    }
    console.error('receive transfer error:', err);
    return res.status(500).json({ error: 'Could not receive stock.' });
  } finally {
    conn.release();
  }
}

module.exports = { listTransfers, listRecipients, dispatch, verify, receive };
