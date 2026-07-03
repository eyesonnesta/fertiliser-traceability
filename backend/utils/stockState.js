const TERMINAL_STOCK_STATUSES = ['expired', 'recalled'];

async function syncStockMovementState(conn, stockId) {
  const [[stock]] = await conn.query(
    'SELECT status, created_by FROM fertiliser_stock WHERE id = ?',
    [stockId]
  );
  if (!stock || TERMINAL_STOCK_STATUSES.includes(stock.status)) {
    return;
  }

  const [[openTransfer]] = await conn.query(
    `SELECT COALESCE(SUM(quantity), 0) AS quantity
     FROM transfers
     WHERE stock_id = ? AND status = 'dispatched'`,
    [stockId]
  );
  const [[receivedTransfer]] = await conn.query(
    `SELECT COUNT(*) AS count
     FROM transfers
     WHERE stock_id = ? AND status = 'received'`,
    [stockId]
  );
  const [holders] = await conn.query(
    `SELECT h.user_id, h.quantity, u.role
     FROM stock_holdings h
     JOIN users u ON u.id = h.user_id
     WHERE h.stock_id = ? AND h.quantity > 0
     ORDER BY
       CASE u.role
         WHEN 'cooperative_official' THEN 3
         WHEN 'depot_manager' THEN 2
         WHEN 'national_supplier' THEN 1
         ELSE 0
       END DESC,
       h.quantity DESC,
       h.updated_at DESC`,
    [stockId]
  );

  const inTransitQuantity = Number(openTransfer.quantity || 0);
  const primaryHolderId = holders[0] ? holders[0].user_id : null;
  const onlyOriginalHolder =
    holders.length === 1 && Number(holders[0].user_id) === Number(stock.created_by);

  const nextStatus = inTransitQuantity > 0
    ? 'in_transit'
    : receivedTransfer.count > 0 && !onlyOriginalHolder
      ? 'received'
      : 'registered';

  await conn.query(
    'UPDATE fertiliser_stock SET status = ?, current_holder_id = ? WHERE id = ?',
    [nextStatus, primaryHolderId, stockId]
  );
}

module.exports = { syncStockMovementState };
