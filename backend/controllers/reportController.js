// =====================================================================
// Report controller
// Read-only audit and stock reporting for the traceability dashboard.
// =====================================================================

const db = require('../config/db');

const ACTIONS = ['registered', 'dispatched', 'received', 'issued', 'expired', 'recalled'];

function stockVisibility(user, alias = 's') {
  if (['system_administrator', 'national_supplier'].includes(user.role)) {
    return { clause: '', params: [] };
  }

  return {
    clause: `AND (
      ${alias}.current_holder_id = ?
      OR ${alias}.created_by = ?
      OR EXISTS (
        SELECT 1 FROM stock_holdings vh
        WHERE vh.stock_id = ${alias}.id AND vh.user_id = ?
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
    )`,
    params: [user.id, user.id, user.id, user.id, user.id, user.id],
  };
}

function dateFilters(query, alias = 'c') {
  const clauses = [];
  const params = [];

  if (query.from) {
    clauses.push(`${alias}.created_at >= ?`);
    params.push(`${query.from} 00:00:00`);
  }
  if (query.to) {
    clauses.push(`${alias}.created_at <= ?`);
    params.push(`${query.to} 23:59:59`);
  }
  if (query.action && ACTIONS.includes(query.action)) {
    clauses.push(`${alias}.action = ?`);
    params.push(query.action);
  }
  if (query.stock_id) {
    const stockId = Number(query.stock_id);
    if (Number.isInteger(stockId) && stockId > 0) {
      clauses.push(`${alias}.stock_id = ?`);
      params.push(stockId);
    }
  }

  return {
    clause: clauses.length ? `AND ${clauses.join(' AND ')}` : '',
    params,
  };
}

function toInt(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

async function getSummary(req, res) {
  try {
    const visibility = stockVisibility(req.user);

    const [stockSummary] = await db.query(
      `SELECT
         COUNT(*) AS total_batches,
         COALESCE(SUM(s.quantity), 0) AS total_bags,
         SUM(s.status = 'registered') AS registered_batches,
         SUM(s.status = 'in_transit') AS in_transit_batches,
         SUM(s.status = 'received') AS received_batches,
         SUM(s.status = 'expired') AS expired_batches,
         SUM(s.status = 'recalled') AS recalled_batches,
         SUM(s.expiry_date >= CURDATE()
           AND s.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
           AND s.status NOT IN ('expired', 'recalled')) AS expiring_soon_batches
       FROM fertiliser_stock s
       WHERE 1 = 1
       ${visibility.clause}`,
      visibility.params
    );

    const actionRows = await db.query(
      `SELECT c.action, COUNT(*) AS count
       FROM custody_log c
       JOIN fertiliser_stock s ON s.id = c.stock_id
       WHERE 1 = 1
       ${visibility.clause}
       GROUP BY c.action
       ORDER BY count DESC, c.action ASC`,
      visibility.params
    );

    const typeRows = await db.query(
      `SELECT s.fertiliser_type, COUNT(*) AS batches, COALESCE(SUM(s.quantity), 0) AS bags
       FROM fertiliser_stock s
       WHERE 1 = 1
       ${visibility.clause}
       GROUP BY s.fertiliser_type
       ORDER BY bags DESC, batches DESC
       LIMIT 8`,
      visibility.params
    );

    const holderRows = await db.query(
      `SELECT u.name, u.role, COALESCE(SUM(h.quantity), 0) AS bags
       FROM stock_holdings h
       JOIN users u ON u.id = h.user_id
       JOIN fertiliser_stock s ON s.id = h.stock_id
       WHERE h.quantity > 0
       ${visibility.clause}
       GROUP BY u.id, u.name, u.role
       ORDER BY bags DESC, u.name ASC
       LIMIT 8`,
      visibility.params
    );

    const [transferSummary] = await db.query(
      `SELECT
         COUNT(*) AS transfer_count,
         COALESCE(SUM(t.quantity), 0) AS moved_bags,
         SUM(t.status = 'dispatched') AS open_transfers,
         SUM(t.status = 'received') AS received_transfers
       FROM transfers t
       JOIN fertiliser_stock s ON s.id = t.stock_id
       WHERE 1 = 1
       ${visibility.clause}`,
      visibility.params
    );

    const [distributionSummary] = await db.query(
      `SELECT
         COUNT(*) AS distribution_count,
         COALESCE(SUM(d.quantity), 0) AS issued_bags
       FROM distribution_records d
       JOIN fertiliser_stock s ON s.id = d.stock_id
       WHERE 1 = 1
       ${visibility.clause}`,
      visibility.params
    );

    return res.json({
      stock: stockSummary || {},
      transfers: transferSummary || {},
      distributions: distributionSummary || {},
      actions: actionRows,
      fertiliser_types: typeRows,
      holders: holderRows,
    });
  } catch (err) {
    console.error('getSummary report error:', err);
    return res.status(500).json({ error: 'Could not load report summary.' });
  }
}

async function listCustodyReport(req, res) {
  try {
    const visibility = stockVisibility(req.user);
    const filters = dateFilters(req.query);
    const limit = toInt(req.query.limit, 100, 1, 250);

    const events = await db.query(
      `SELECT
         c.id, c.action, c.notes, c.created_at,
         s.id AS stock_id, s.batch_number, s.fertiliser_type, s.quantity, s.status,
         actor.name AS user_name, actor.role AS user_role,
         holder.name AS holder_name, holder.role AS holder_role
       FROM custody_log c
       JOIN fertiliser_stock s ON s.id = c.stock_id
       JOIN users actor ON actor.id = c.user_id
       LEFT JOIN users holder ON holder.id = s.current_holder_id
       WHERE 1 = 1
       ${visibility.clause}
       ${filters.clause}
       ORDER BY c.created_at DESC, c.id DESC
       LIMIT ?`,
      [...visibility.params, ...filters.params, limit]
    );

    return res.json({ events, filters: req.query });
  } catch (err) {
    console.error('listCustodyReport error:', err);
    return res.status(500).json({ error: 'Could not load custody report.' });
  }
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

async function exportCustodyCsv(req, res) {
  try {
    const visibility = stockVisibility(req.user);
    const filters = dateFilters(req.query);

    const events = await db.query(
      `SELECT
         DATE_FORMAT(c.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
         c.action, s.batch_number, s.fertiliser_type, s.quantity,
         s.status, actor.name AS user_name, actor.role AS user_role,
         holder.name AS holder_name, c.notes
       FROM custody_log c
       JOIN fertiliser_stock s ON s.id = c.stock_id
       JOIN users actor ON actor.id = c.user_id
       LEFT JOIN users holder ON holder.id = s.current_holder_id
       WHERE 1 = 1
       ${visibility.clause}
       ${filters.clause}
       ORDER BY c.created_at DESC, c.id DESC`,
      [...visibility.params, ...filters.params]
    );

    const header = [
      'created_at',
      'action',
      'batch_number',
      'fertiliser_type',
      'quantity',
      'status',
      'user_name',
      'user_role',
      'holder_name',
      'notes',
    ];
    const lines = [
      header.join(','),
      ...events.map((event) => header.map((key) => csvCell(event[key])).join(',')),
    ];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="custody-report.csv"');
    return res.send(lines.join('\n'));
  } catch (err) {
    console.error('exportCustodyCsv error:', err);
    return res.status(500).json({ error: 'Could not export custody report.' });
  }
}

module.exports = { getSummary, listCustodyReport, exportCustodyCsv };
