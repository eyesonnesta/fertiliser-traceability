// =====================================================================
// Idempotent migration for recall status management.
// Adds lifecycle status, latest notes, and updater metadata to recalls.
// Run from backend/:  node db/migrate-recall-status.js
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
      'recall_records',
      'status',
      `ALTER TABLE recall_records
       ADD COLUMN status ENUM('pending','in_review','resolved','rejected')
       NOT NULL DEFAULT 'pending' AFTER flagged_at`
    );

    await addColumnIfMissing(
      'recall_records',
      'status_notes',
      'ALTER TABLE recall_records ADD COLUMN status_notes VARCHAR(255) NULL AFTER status'
    );

    await addColumnIfMissing(
      'recall_records',
      'status_updated_by',
      'ALTER TABLE recall_records ADD COLUMN status_updated_by INT NULL AFTER status_notes'
    );

    await addColumnIfMissing(
      'recall_records',
      'status_updated_at',
      'ALTER TABLE recall_records ADD COLUMN status_updated_at TIMESTAMP NULL AFTER status_updated_by'
    );

    if (await indexExists('recall_records', 'idx_recall_status')) {
      console.log('- idx_recall_status already exists');
    } else {
      await db.query('CREATE INDEX idx_recall_status ON recall_records(status)');
      console.log('+ created idx_recall_status');
    }

    if (await constraintExists('recall_records', 'fk_recall_status_user')) {
      console.log('- fk_recall_status_user already exists');
    } else {
      await db.query(
        `ALTER TABLE recall_records
         ADD CONSTRAINT fk_recall_status_user
         FOREIGN KEY (status_updated_by) REFERENCES users(id)`
      );
      console.log('+ created fk_recall_status_user');
    }

    console.log('Done. Recall status support is ready.');
    process.exit(0);
  } catch (err) {
    console.error('Recall status migration failed:', err);
    process.exit(1);
  }
}

migrate();
