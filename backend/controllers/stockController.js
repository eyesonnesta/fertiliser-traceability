// =====================================================================
// Stock controller
// Handles the Stock Registration + QR Code Generation module.
//
// The key action is registerStock: it does THREE things in one logical
// step, wrapped in a transaction so they all succeed or all fail together:
//   1. insert the fertiliser_stock row
//   2. generate a QR code and insert the qr_codes row
//   3. write the first custody_log entry ("registered")
// =====================================================================

const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const { buildPayload, generateQrImage, QR_DIR } = require('../utils/qr');
const { isDemoDepot } = require('../utils/demoDepots');

const STOCK_SELECT_COLUMNS = `s.*, u.name AS holder_name, u.role AS holder_role,
        archiver.name AS archived_by_name, archiver.role AS archived_by_role,
        COALESCE(uh.quantity, 0) AS held_quantity,
        COALESCE(tq.in_transit_quantity, 0) AS in_transit_quantity,
        COALESCE(dq.issued_quantity, 0) AS issued_quantity,
        COALESCE(hq.total_held_quantity, 0) AS total_held_quantity`;

const STOCK_SUMMARY_JOINS = `LEFT JOIN users u ON u.id = s.current_holder_id
       LEFT JOIN users archiver ON archiver.id = s.archived_by
       LEFT JOIN (
         SELECT stock_id, SUM(quantity) AS in_transit_quantity
         FROM transfers
         WHERE status = 'dispatched'
         GROUP BY stock_id
       ) tq ON tq.stock_id = s.id
       LEFT JOIN (
         SELECT stock_id, SUM(quantity) AS issued_quantity
         FROM distribution_records
         GROUP BY stock_id
       ) dq ON dq.stock_id = s.id
       LEFT JOIN (
         SELECT stock_id, SUM(quantity) AS total_held_quantity
         FROM stock_holdings
         GROUP BY stock_id
       ) hq ON hq.stock_id = s.id`;

const STOCK_LIST_QUERY_KEYS = ['search', 'status', 'type', 'expiryStatus', 'sort', 'order', 'page', 'limit'];
const STOCK_STATUSES = ['registered', 'in_transit', 'received', 'expired', 'recalled'];
const EXPIRY_STATUSES = ['valid', 'expiringSoon', 'expired'];
const SORT_VALUES = ['latest', 'oldest', 'expiry_date', 'batch_number', 'status'];
const ORDER_VALUES = ['asc', 'desc'];
const DEFAULT_STOCK_PAGE = 1;
const DEFAULT_STOCK_LIMIT = 20;
const MAX_STOCK_LIMIT = 100;
const STOCK_UPDATE_FIELDS = [
  'fertiliser_type',
  'quantity',
  'manufacture_date',
  'expiry_date',
  'source',
  'destination',
  'responsible_personnel',
];

function cleanText(value, maxLength = 160) {
  if (value === undefined || value === null || value === '') return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

function parsePositiveInt(value, fallback, { max } = {}) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  if (max && parsed > max) return max;
  return parsed;
}

function normalizeEnum(value, allowedValues, fieldName) {
  const normalized = cleanText(value, 40);
  if (!normalized) return { value: null };
  if (!allowedValues.includes(normalized)) {
    return { error: `${fieldName} must be one of: ${allowedValues.join(', ')}.` };
  }
  return { value: normalized };
}

function expiryStatusSqlValue(expiryStatus) {
  if (expiryStatus === 'expiringSoon') return 'expiring_soon';
  return expiryStatus;
}

function buildStockOrderClause(sort, order) {
  if (sort === 'oldest') return 's.created_at ASC, s.id ASC';
  if (sort === 'latest') return 's.created_at DESC, s.id DESC';

  const direction = order.toUpperCase();
  const sortColumns = {
    expiry_date: 's.expiry_date',
    batch_number: 's.batch_number',
    status: 's.status',
  };
  return `${sortColumns[sort]} ${direction}, s.id DESC`;
}

function buildStockListOptions(query) {
  const hasStockListQuery = STOCK_LIST_QUERY_KEYS.some((key) => query[key] !== undefined);
  const page = parsePositiveInt(query.page, DEFAULT_STOCK_PAGE);
  const limit = parsePositiveInt(query.limit, DEFAULT_STOCK_LIMIT, { max: MAX_STOCK_LIMIT });

  if (page === null || limit === null) {
    return { error: 'page and limit must be positive whole numbers.' };
  }

  const status = normalizeEnum(query.status, STOCK_STATUSES, 'status');
  if (status.error) return status;

  const expiryStatus = normalizeEnum(query.expiryStatus, EXPIRY_STATUSES, 'expiryStatus');
  if (expiryStatus.error) return expiryStatus;

  const sort = normalizeEnum(query.sort || 'latest', SORT_VALUES, 'sort');
  if (sort.error) return sort;

  const order = normalizeEnum(query.order || 'desc', ORDER_VALUES, 'order');
  if (order.error) return order;

  return {
    page,
    limit,
    paginated: hasStockListQuery,
    filters: {
      search: cleanText(query.search, 120),
      status: status.value,
      type: cleanText(query.type, 120),
      expiryStatus: expiryStatus.value,
    },
    orderClause: buildStockOrderClause(sort.value, order.value),
  };
}

function applyStockFilters(filters, whereClauses, params) {
  if (filters.search) {
    const term = `%${filters.search}%`;
    whereClauses.push(`(
      s.batch_number LIKE ?
      OR s.fertiliser_type LIKE ?
    )`);
    params.push(term, term);
  }

  if (filters.status) {
    whereClauses.push('s.status = ?');
    params.push(filters.status);
  }
  if (filters.type) {
    whereClauses.push('s.fertiliser_type = ?');
    params.push(filters.type);
  }
  const expiryStatus = expiryStatusSqlValue(filters.expiryStatus);
  if (expiryStatus === 'expired') {
    whereClauses.push('s.expiry_date < CURDATE()');
  }
  if (expiryStatus === 'expiring_soon') {
    whereClauses.push('s.expiry_date >= CURDATE() AND s.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)');
  }
  if (expiryStatus === 'valid') {
    whereClauses.push('s.expiry_date > DATE_ADD(CURDATE(), INTERVAL 30 DAY)');
  }
}

function buildStockListQuery(user, options) {
  const isPrivileged = ['system_administrator', 'national_supplier'].includes(user.role);
  const params = [user.id];
  const whereClauses = [];
  const userHoldingJoin = isPrivileged
    ? 'LEFT JOIN stock_holdings uh ON uh.stock_id = s.id AND uh.user_id = ?'
    : 'JOIN stock_holdings uh ON uh.stock_id = s.id AND uh.user_id = ?';

  if (!isPrivileged) {
    whereClauses.push('uh.quantity > 0');
  }
  if (user.role !== 'system_administrator') {
    whereClauses.push('s.is_archived = 0');
  }

  applyStockFilters(options.filters, whereClauses, params);

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const fromSql = `FROM fertiliser_stock s
       ${STOCK_SUMMARY_JOINS}
       ${userHoldingJoin}`;

  const dataParams = [...params];
  let limitSql = '';
  if (options.paginated) {
    limitSql = 'LIMIT ? OFFSET ?';
    dataParams.push(options.limit, (options.page - 1) * options.limit);
  }

  return {
    dataSql: `SELECT ${STOCK_SELECT_COLUMNS}
       ${fromSql}
       ${whereSql}
       ORDER BY ${options.orderClause}
       ${limitSql}`,
    countSql: `SELECT COUNT(*) AS total
       ${fromSql}
       ${whereSql}`,
    dataParams,
    countParams: params,
  };
}

function stockVisibility(user, alias = 's') {
  if (['system_administrator', 'national_supplier'].includes(user.role)) {
    if (user.role === 'system_administrator') {
      return { clause: '', params: [] };
    }
    return { clause: `AND ${alias}.is_archived = 0`, params: [] };
  }

  return {
    clause: `AND (
      ${alias}.is_archived = 0
      AND (
      ${alias}.current_holder_id = ?
      OR ${alias}.created_by = ?
      OR EXISTS (
        SELECT 1 FROM stock_holdings vh
        WHERE vh.stock_id = ${alias}.id AND vh.user_id = ? AND vh.quantity > 0
      )
      OR EXISTS (
        SELECT 1 FROM transfers vt
        WHERE vt.stock_id = ${alias}.id
          AND (vt.from_user_id = ? OR vt.to_user_id = ?)
      )
      OR EXISTS (
        SELECT 1 FROM custody_log vc
        WHERE vc.stock_id = ${alias}.id AND vc.user_id = ?
      )
      )
    )`,
    params: [user.id, user.id, user.id, user.id, user.id, user.id],
  };
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function toDateOnly(value) {
  if (value instanceof Date) {
    return formatLocalDate(value);
  }
  return String(value || '').slice(0, 10);
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayDateString() {
  return formatLocalDate(new Date());
}

function addDaysToDateString(dateString, days) {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

function isValidDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
  );
}

function validateStockDates(manufactureDate, expiryDate, { enforceRelativeDates = true } = {}) {
  if (!isValidDateOnly(manufactureDate) || !isValidDateOnly(expiryDate)) {
    return { error: 'manufacture_date and expiry_date must be valid YYYY-MM-DD dates.' };
  }
  if (expiryDate <= manufactureDate) {
    return { error: 'expiry_date must be after manufacture_date.' };
  }
  if (!enforceRelativeDates) {
    return { valid: true };
  }

  const today = todayDateString();
  const minimumExpiryDate = addDaysToDateString(today, 30);
  if (manufactureDate > today) {
    return { error: 'manufacture_date cannot be after today.' };
  }
  if (expiryDate < minimumExpiryDate) {
    return { error: 'expiry_date must be at least 30 days from today.' };
  }
  return { valid: true };
}

function normalizeStockUpdatePayload(body, stock) {
  const updates = {};

  if (hasOwn(body, 'batch_number')) {
    const batchNumber = String(body.batch_number || '').trim();
    if (batchNumber && batchNumber !== stock.batch_number) {
      return { error: 'batch_number cannot be changed because QR and custody records depend on it.' };
    }
  }

  for (const field of STOCK_UPDATE_FIELDS) {
    if (!hasOwn(body, field)) continue;
    if (field === 'quantity') {
      const quantity = Number(body.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        return { error: 'quantity must be a whole number greater than zero.' };
      }
      updates.quantity = quantity;
      continue;
    }

    const value = String(body[field] || '').trim();
    if (!value) {
      return { error: `${field} is required.` };
    }
    updates[field] = value;
  }

  if (Object.keys(updates).length === 0) {
    return { error: 'At least one stock field is required.' };
  }

  const next = { ...stock, ...updates };
  if (
    next.fertiliser_type.length > 120
    || next.source.length > 160
    || next.destination.length > 160
    || next.responsible_personnel.length > 160
  ) {
    return { error: 'One or more stock fields exceed the allowed length.' };
  }
  if (
    updates.destination !== undefined
    && updates.destination !== stock.destination
    && !isDemoDepot(updates.destination)
  ) {
      return { error: 'destination must be one of the demo destination options.' };
  }
  const manufactureDate = toDateOnly(next.manufacture_date);
  const expiryDate = toDateOnly(next.expiry_date);
  const dateValidation = validateStockDates(manufactureDate, expiryDate, {
    enforceRelativeDates: true,
  });
  if (dateValidation.error) return dateValidation;

  return { updates };
}

async function getMovementCounts(conn, stockId) {
  const [rows] = await conn.query(
    `SELECT
       (SELECT COUNT(*) FROM transfers WHERE stock_id = ?) AS transfer_count,
       (SELECT COUNT(*) FROM distribution_records WHERE stock_id = ?) AS distribution_count`,
    [stockId, stockId]
  );
  return {
    transferCount: Number(rows[0]?.transfer_count || 0),
    distributionCount: Number(rows[0]?.distribution_count || 0),
  };
}

function canUpdateStock(user, stock, movementCounts, updates) {
  if (user.role === 'system_administrator') {
    if (
      updates.quantity !== undefined
      && Number(updates.quantity) !== Number(stock.quantity)
      && (movementCounts.transferCount > 0 || movementCounts.distributionCount > 0)
    ) {
      return { error: 'quantity cannot be changed after stock movement or distribution has started.' };
    }
    return { allowed: true };
  }

  if (user.role !== 'national_supplier') {
    return { error: 'You do not have permission to update stock.' };
  }
  if (Number(stock.created_by) !== Number(user.id)) {
    return { error: 'You can only update stock you registered.' };
  }
  if (stock.is_archived) {
    return { error: 'Archived stock cannot be updated by suppliers.' };
  }
  if (
    stock.status !== 'registered'
    || movementCounts.transferCount > 0
    || movementCounts.distributionCount > 0
  ) {
    return { error: 'Supplier updates are allowed only before dispatch.' };
  }
  return { allowed: true };
}

async function fetchStockForMutation(conn, stockId) {
  const [rows] = await conn.query(
    `SELECT *
     FROM fertiliser_stock
     WHERE id = ?
     FOR UPDATE`,
    [stockId]
  );
  return rows[0] || null;
}

async function updateHoldingQuantity(conn, stock, quantity) {
  if (!stock.current_holder_id) return;
  const [result] = await conn.query(
    'UPDATE stock_holdings SET quantity = ? WHERE stock_id = ? AND user_id = ?',
    [quantity, stock.id, stock.current_holder_id]
  );
  if (result.affectedRows === 0) {
    await conn.query(
      'INSERT INTO stock_holdings (stock_id, user_id, quantity) VALUES (?, ?, ?)',
      [stock.id, stock.current_holder_id, quantity]
    );
  }
}

// POST /api/stock   (national_supplier only)
async function registerStock(req, res) {
  // Grab a dedicated connection so we can run a transaction.
  const conn = await db.pool.getConnection();
  try {
    const {
      quantity,
      manufacture_date, expiry_date,
    } = req.body;
    const batch_number = String(req.body.batch_number || '').trim();
    const fertiliser_type = String(req.body.fertiliser_type || '').trim();
    const source = String(req.user.name || '').trim();
    const destination = String(req.body.destination || '').trim();
    const responsible_personnel = String(req.user.name || '').trim();
    const stockQuantity = Number(quantity);

    // --- Validation ---
    const required = { batch_number, fertiliser_type, quantity,
      manufacture_date, expiry_date, source, destination, responsible_personnel };
    for (const [field, value] of Object.entries(required)) {
      if (value === undefined || value === null || value === '') {
        return res.status(400).json({ error: `${field} is required.` });
      }
    }
    if (
      batch_number.length > 80
      || fertiliser_type.length > 120
      || source.length > 160
      || destination.length > 160
      || responsible_personnel.length > 160
    ) {
      return res.status(400).json({ error: 'One or more stock fields exceed the allowed length.' });
    }
    if (!Number.isInteger(stockQuantity) || stockQuantity <= 0) {
      return res.status(400).json({ error: 'quantity must be a whole number greater than zero.' });
    }
    if (!isDemoDepot(destination)) {
      return res.status(400).json({ error: 'destination must be one of the demo destination options.' });
    }
    const dateValidation = validateStockDates(manufacture_date, expiry_date);
    if (dateValidation.error) {
      return res.status(400).json({ error: dateValidation.error });
    }

    // --- Begin transaction ---
    await conn.beginTransaction();

    // 1. Insert the stock. The registering supplier becomes the holder.
    const [stockResult] = await conn.query(
      `INSERT INTO fertiliser_stock
        (batch_number, fertiliser_type, quantity, manufacture_date, expiry_date,
         source, destination, responsible_personnel, status, current_holder_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'registered', ?, ?)`,
      [batch_number, fertiliser_type, stockQuantity, manufacture_date, expiry_date,
       source, destination, responsible_personnel, req.user.id, req.user.id]
    );
    const stockId = stockResult.insertId;

    // Track the physical bags the supplier currently holds. The batch row
    // keeps the original total; stock_holdings enables partial dispatches.
    await conn.query(
      'INSERT INTO stock_holdings (stock_id, user_id, quantity) VALUES (?, ?, ?)',
      [stockId, req.user.id, stockQuantity]
    );

    // 2. Generate the QR (unique payload -> PNG -> db row).
    const payload = buildPayload(batch_number);
    const imagePath = await generateQrImage(payload);
    await conn.query(
      'INSERT INTO qr_codes (stock_id, qr_payload, qr_image_path) VALUES (?, ?, ?)',
      [stockId, payload, imagePath]
    );

    // 3. First chain-of-custody entry.
    await conn.query(
      'INSERT INTO custody_log (stock_id, user_id, action, notes) VALUES (?, ?, ?, ?)',
      [stockId, req.user.id, 'registered', `Batch ${batch_number} registered.`]
    );

    await conn.commit();

    return res.status(201).json({
      message: 'Stock registered and QR code generated.',
      stock_id: stockId,
      qr_payload: payload,
      // URL the frontend can hit to display/download the QR image.
      qr_image_url: `/api/stock/${stockId}/qr`,
    });
  } catch (err) {
    await conn.rollback();
    // Duplicate batch_number triggers MySQL error code ER_DUP_ENTRY.
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'That batch number is already registered.' });
    }
    console.error('registerStock error:', err);
    return res.status(500).json({ error: 'Could not register stock.' });
  } finally {
    conn.release(); // always return the connection to the pool
  }
}

// PATCH /api/stock/:id
// Updates editable stock fields without changing QR/custody identity.
async function updateStock(req, res) {
  const conn = await db.pool.getConnection();
  try {
    const stockId = Number(req.params.id);
    if (!Number.isInteger(stockId) || stockId <= 0) {
      return res.status(400).json({ error: 'Stock id must be valid.' });
    }

    await conn.beginTransaction();

    const stock = await fetchStockForMutation(conn, stockId);
    if (!stock) {
      await conn.rollback();
      return res.status(404).json({ error: 'Stock not found.' });
    }

    const payload = normalizeStockUpdatePayload(req.body, stock);
    if (payload.error) {
      await conn.rollback();
      return res.status(400).json({ error: payload.error });
    }

    const movementCounts = await getMovementCounts(conn, stock.id);
    const permission = canUpdateStock(req.user, stock, movementCounts, payload.updates);
    if (!permission.allowed) {
      await conn.rollback();
      return res.status(403).json({ error: permission.error });
    }

    const fields = Object.keys(payload.updates);
    const setClauses = fields.map((field) => `${field} = ?`);
    const values = fields.map((field) => payload.updates[field]);

    await conn.query(
      `UPDATE fertiliser_stock SET ${setClauses.join(', ')} WHERE id = ?`,
      [...values, stock.id]
    );

    if (
      payload.updates.quantity !== undefined
      && Number(payload.updates.quantity) !== Number(stock.quantity)
    ) {
      await updateHoldingQuantity(conn, stock, payload.updates.quantity);
    }

    await conn.query(
      'INSERT INTO custody_log (stock_id, user_id, action, notes) VALUES (?, ?, ?, ?)',
      [
        stock.id,
        req.user.id,
        'stock_updated',
        `Stock details updated: ${fields.join(', ')}.`,
      ]
    );

    const [updatedRows] = await conn.query('SELECT * FROM fertiliser_stock WHERE id = ?', [stock.id]);
    await conn.commit();

    return res.json({
      message: 'Stock updated successfully.',
      stock: updatedRows[0],
    });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'That batch number is already registered.' });
    }
    console.error('updateStock error:', err);
    return res.status(500).json({ error: 'Could not update stock.' });
  } finally {
    conn.release();
  }
}

// PATCH /api/stock/:id/archive
// Soft-archives stock. Records stay available for QR, reports, recalls, and audit.
async function archiveStock(req, res) {
  const conn = await db.pool.getConnection();
  try {
    const stockId = Number(req.params.id);
    if (!Number.isInteger(stockId) || stockId <= 0) {
      return res.status(400).json({ error: 'Stock id must be valid.' });
    }
    if (req.user.role !== 'system_administrator') {
      return res.status(403).json({ error: 'Only administrators can archive stock.' });
    }

    await conn.beginTransaction();

    const stock = await fetchStockForMutation(conn, stockId);
    if (!stock) {
      await conn.rollback();
      return res.status(404).json({ error: 'Stock not found.' });
    }
    if (stock.is_archived) {
      await conn.rollback();
      return res.status(409).json({ error: 'Stock is already archived.' });
    }

    await conn.query(
      'UPDATE fertiliser_stock SET is_archived = 1, archived_at = NOW(), archived_by = ? WHERE id = ?',
      [req.user.id, stock.id]
    );
    await conn.query(
      'INSERT INTO custody_log (stock_id, user_id, action, notes) VALUES (?, ?, ?, ?)',
      [stock.id, req.user.id, 'stock_archived', `Batch ${stock.batch_number} archived.`]
    );

    const [updatedRows] = await conn.query('SELECT * FROM fertiliser_stock WHERE id = ?', [stock.id]);
    await conn.commit();

    return res.json({
      message: 'Stock archived successfully.',
      stock: updatedRows[0],
    });
  } catch (err) {
    await conn.rollback();
    console.error('archiveStock error:', err);
    return res.status(500).json({ error: 'Could not archive stock.' });
  } finally {
    conn.release();
  }
}

// PATCH /api/stock/:id/restore
// Restores a soft-archived stock row for active use.
async function restoreStock(req, res) {
  const conn = await db.pool.getConnection();
  try {
    const stockId = Number(req.params.id);
    if (!Number.isInteger(stockId) || stockId <= 0) {
      return res.status(400).json({ error: 'Stock id must be valid.' });
    }
    if (req.user.role !== 'system_administrator') {
      return res.status(403).json({ error: 'Only administrators can restore stock.' });
    }

    await conn.beginTransaction();

    const stock = await fetchStockForMutation(conn, stockId);
    if (!stock) {
      await conn.rollback();
      return res.status(404).json({ error: 'Stock not found.' });
    }
    if (!stock.is_archived) {
      await conn.rollback();
      return res.status(409).json({ error: 'Stock is not archived.' });
    }

    await conn.query(
      'UPDATE fertiliser_stock SET is_archived = 0, archived_at = NULL, archived_by = NULL WHERE id = ?',
      [stock.id]
    );
    await conn.query(
      'INSERT INTO custody_log (stock_id, user_id, action, notes) VALUES (?, ?, ?, ?)',
      [stock.id, req.user.id, 'stock_restored', `Batch ${stock.batch_number} restored from archive.`]
    );

    const [updatedRows] = await conn.query('SELECT * FROM fertiliser_stock WHERE id = ?', [stock.id]);
    await conn.commit();

    return res.json({
      message: 'Stock restored successfully.',
      stock: updatedRows[0],
    });
  } catch (err) {
    await conn.rollback();
    console.error('restoreStock error:', err);
    return res.status(500).json({ error: 'Could not restore stock.' });
  } finally {
    conn.release();
  }
}

// GET /api/stock   (any authenticated user)
// Lists stock. Admin/supplier see everything; depot & cooperative users
// see batches they currently hold (a small role-aware filter).
async function listStock(req, res) {
  try {
    const options = buildStockListOptions(req.query);
    if (options.error) {
      return res.status(400).json({ error: options.error });
    }

    const query = buildStockListQuery(req.user, options);
    const [rows, totalRows] = await Promise.all([
      db.query(query.dataSql, query.dataParams),
      db.query(query.countSql, query.countParams),
    ]);
    const total = Number(totalRows[0]?.total || 0);
    const effectiveLimit = options.paginated ? options.limit : (rows.length || DEFAULT_STOCK_LIMIT);
    const totalPages = effectiveLimit > 0 ? Math.ceil(total / effectiveLimit) : 0;

    return res.json({
      stock: rows,
      pagination: {
        page: options.page,
        limit: effectiveLimit,
        total,
        totalPages,
      },
    });
  } catch (err) {
    console.error('listStock error:', err);
    return res.status(500).json({ error: 'Could not load stock.' });
  }
}

// GET /api/stock/:id   (any authenticated user)
// Returns one batch plus its QR payload and its custody history.
async function getStock(req, res) {
  try {
    const { id } = req.params;
    const visibility = stockVisibility(req.user);
    const stockRows = await db.query(
      `SELECT s.*, u.name AS holder_name, u.role AS holder_role,
              archiver.name AS archived_by_name, archiver.role AS archived_by_role,
              COALESCE(uh.quantity, 0) AS held_quantity,
              COALESCE(tq.in_transit_quantity, 0) AS in_transit_quantity,
              COALESCE(dq.issued_quantity, 0) AS issued_quantity,
              COALESCE(hq.total_held_quantity, 0) AS total_held_quantity
       FROM fertiliser_stock s
       LEFT JOIN users u ON u.id = s.current_holder_id
       LEFT JOIN users archiver ON archiver.id = s.archived_by
       LEFT JOIN stock_holdings uh ON uh.stock_id = s.id AND uh.user_id = ?
       LEFT JOIN (
         SELECT stock_id, SUM(quantity) AS in_transit_quantity
         FROM transfers
         WHERE status = 'dispatched'
         GROUP BY stock_id
       ) tq ON tq.stock_id = s.id
       LEFT JOIN (
         SELECT stock_id, SUM(quantity) AS issued_quantity
         FROM distribution_records
         GROUP BY stock_id
       ) dq ON dq.stock_id = s.id
       LEFT JOIN (
         SELECT stock_id, SUM(quantity) AS total_held_quantity
         FROM stock_holdings
         GROUP BY stock_id
       ) hq ON hq.stock_id = s.id
       WHERE s.id = ?
       ${visibility.clause}`,
      [req.user.id, id, ...visibility.params]
    );
    if (stockRows.length === 0) {
      return res.status(404).json({ error: 'Stock not found.' });
    }
    const qrRows = await db.query('SELECT qr_payload FROM qr_codes WHERE stock_id = ?', [id]);
    const history = await db.query(
      `SELECT c.action, c.notes, c.created_at, u.name AS user_name, u.role AS user_role
       FROM custody_log c JOIN users u ON u.id = c.user_id
       WHERE c.stock_id = ? ORDER BY c.created_at ASC`,
      [id]
    );
    const holdings = await db.query(
      `SELECT h.quantity, h.updated_at, u.id AS user_id, u.name AS user_name, u.role AS user_role
       FROM stock_holdings h
       JOIN users u ON u.id = h.user_id
       WHERE h.stock_id = ? AND h.quantity > 0
       ORDER BY h.quantity DESC, h.updated_at DESC`,
      [id]
    );
    const distributions = await db.query(
      `SELECT d.id, d.quantity, d.recipient_name, d.recipient_identifier,
              d.location, d.notes, d.issued_at,
              u.name AS cooperative_name, u.role AS cooperative_role
       FROM distribution_records d
       JOIN users u ON u.id = d.cooperative_user_id
       WHERE d.stock_id = ?
       ORDER BY d.issued_at DESC, d.id DESC`,
      [id]
    );
    return res.json({
      stock: stockRows[0],
      qr_payload: qrRows[0] ? qrRows[0].qr_payload : null,
      custody_history: history,
      holdings,
      distributions,
    });
  } catch (err) {
    console.error('getStock error:', err);
    return res.status(500).json({ error: 'Could not load stock.' });
  }
}

// GET /api/stock/:id/qr   (any authenticated user)
// Streams the QR PNG so an <img> tag can display it.
async function getStockQr(req, res) {
  try {
    const { id } = req.params;
    const visibility = stockVisibility(req.user);
    const rows = await db.query(
      `SELECT q.qr_image_path
       FROM qr_codes q
       JOIN fertiliser_stock s ON s.id = q.stock_id
       WHERE q.stock_id = ?
       ${visibility.clause}`,
      [id, ...visibility.params]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'QR code not found.' });
    }
    const imagePath = rows[0].qr_image_path;
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ error: 'QR image file missing on server.' });
    }
    return res.sendFile(path.resolve(imagePath));
  } catch (err) {
    console.error('getStockQr error:', err);
    return res.status(500).json({ error: 'Could not load QR image.' });
  }
}

module.exports = {
  registerStock,
  updateStock,
  archiveStock,
  restoreStock,
  listStock,
  getStock,
  getStockQr,
};
