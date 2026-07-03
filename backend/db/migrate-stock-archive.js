// =====================================================================
// Idempotent migration for stock archive/restore support.
// Adds soft-archive fields to fertiliser_stock without deleting records.
// Run from backend/:  node db/migrate-stock-archive.js
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

async function indexExists(tableName, indexName) {
  const rows = await db.query(
    `SELECT INDEX_NAME
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?`,
    [tableName, indexName]
  );
  return rows.length > 0;
}

async function constraintExists(tableName, constraintName) {
  const rows = await db.query(
    `SELECT CONSTRAINT_NAME
     FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND CONSTRAINT_NAME = ?`,
    [tableName, constraintName]
  );
  return rows.length > 0;
}

async function addColumnIfMissing(tableName, columnName, sql) {
  if (await columnExists(tableName, columnName)) {
    console.log(`- ${tableName}.${columnName} already exists`);
    return;
  }
  await db.query(sql);
  console.log(`+ added ${tableName}.${columnName}`);
}

async function migrate() {
  try {
    await addColumnIfMissing(
      'fertiliser_stock',
      'is_archived',
      'ALTER TABLE fertiliser_stock ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT FALSE AFTER created_at'
    );

    await addColumnIfMissing(
      'fertiliser_stock',
      'archived_at',
      'ALTER TABLE fertiliser_stock ADD COLUMN archived_at TIMESTAMP NULL AFTER is_archived'
    );

    await addColumnIfMissing(
      'fertiliser_stock',
      'archived_by',
      'ALTER TABLE fertiliser_stock ADD COLUMN archived_by INT NULL AFTER archived_at'
    );

    if (await indexExists('fertiliser_stock', 'idx_stock_archived')) {
      console.log('- idx_stock_archived already exists');
    } else {
      await db.query('CREATE INDEX idx_stock_archived ON fertiliser_stock(is_archived)');
      console.log('+ created idx_stock_archived');
    }

    if (await constraintExists('fertiliser_stock', 'fk_stock_archiver')) {
      console.log('- fk_stock_archiver already exists');
    } else {
      await db.query(
        `ALTER TABLE fertiliser_stock
         ADD CONSTRAINT fk_stock_archiver
         FOREIGN KEY (archived_by) REFERENCES users(id)`
      );
      console.log('+ created fk_stock_archiver');
    }

    console.log('Done. Stock archive support is ready.');
    process.exit(0);
  } catch (err) {
    console.error('Stock archive migration failed:', err);
    process.exit(1);
  }
}

migrate();
