// =====================================================================
// One-time/idempotent migration for partial dispatch support.
// Adds stock_holdings and transfers.quantity, then backfills holdings from
// existing stock so current demo data is not lost.
// Run from backend/:  node db/migrate-partial-dispatch.js
// =====================================================================

const db = require('../config/db');

async function columnExists(tableName, columnName) {
  const rows = await db.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return rows.length > 0;
}

async function tableExists(tableName) {
  const rows = await db.query(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?`,
    [tableName]
  );
  return rows.length > 0;
}

async function migrate() {
  try {
    const hasHoldings = await tableExists('stock_holdings');
    if (!hasHoldings) {
      await db.query(`
        CREATE TABLE stock_holdings (
          id         INT AUTO_INCREMENT PRIMARY KEY,
          stock_id   INT       NOT NULL,
          user_id    INT       NOT NULL,
          quantity   INT       NOT NULL DEFAULT 0,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                                 ON UPDATE CURRENT_TIMESTAMP,

          CONSTRAINT uq_stock_holding_user UNIQUE (stock_id, user_id),
          CONSTRAINT fk_holding_stock FOREIGN KEY (stock_id) REFERENCES fertiliser_stock(id),
          CONSTRAINT fk_holding_user  FOREIGN KEY (user_id)  REFERENCES users(id)
        )
      `);
      console.log('+ created stock_holdings');
    } else {
      console.log('- stock_holdings already exists');
    }

    const hasTransferQuantity = await columnExists('transfers', 'quantity');
    if (!hasTransferQuantity) {
      await db.query(
        'ALTER TABLE transfers ADD COLUMN quantity INT NOT NULL DEFAULT 0 AFTER to_user_id'
      );
      console.log('+ added transfers.quantity');
    } else {
      console.log('- transfers.quantity already exists');
    }

    await db.query(`
      UPDATE transfers t
      JOIN fertiliser_stock s ON s.id = t.stock_id
      SET t.quantity = s.quantity
      WHERE t.quantity = 0
    `);
    console.log('+ backfilled legacy transfer quantities');

    // Backfill holdings from the stock row's current holder. Existing rows
    // are left alone so the script can be run safely more than once.
    await db.query(`
      INSERT INTO stock_holdings (stock_id, user_id, quantity)
      SELECT s.id, s.current_holder_id, s.quantity
      FROM fertiliser_stock s
      LEFT JOIN stock_holdings h
        ON h.stock_id = s.id AND h.user_id = s.current_holder_id
      WHERE s.current_holder_id IS NOT NULL
        AND h.id IS NULL
    `);
    console.log('+ backfilled current stock holdings');

    await db.query('CREATE INDEX idx_holdings_user ON stock_holdings(user_id)');
  } catch (err) {
    if (err.code !== 'ER_DUP_KEYNAME') {
      console.error('Partial dispatch migration failed:', err);
      process.exit(1);
    }
  }

  try {
    await db.query('CREATE INDEX idx_holdings_stock ON stock_holdings(stock_id)');
  } catch (err) {
    if (err.code !== 'ER_DUP_KEYNAME') {
      console.error('Partial dispatch migration failed:', err);
      process.exit(1);
    }
  }

  console.log('Done. Partial dispatch support is ready.');
  process.exit(0);
}

migrate();
