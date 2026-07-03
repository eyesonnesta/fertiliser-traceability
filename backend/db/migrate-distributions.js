// One-time/idempotent migration for cooperative issue/distribution records.

const db = require('../config/db');

async function tableExists(tableName) {
  const rows = await db.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [tableName]
  );
  return Number(rows[0].count) > 0;
}

async function indexExists(tableName, indexName) {
  const rows = await db.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    [tableName, indexName]
  );
  return Number(rows[0].count) > 0;
}

async function ensureIndex(tableName, indexName, sql) {
  if (await indexExists(tableName, indexName)) {
    console.log(`- ${indexName} already exists`);
    return;
  }
  await db.query(sql);
  console.log(`+ added ${indexName}`);
}

async function migrate() {
  try {
    if (await tableExists('distribution_records')) {
      console.log('- distribution_records already exists');
    } else {
      await db.query(
        `CREATE TABLE distribution_records (
          id                   INT AUTO_INCREMENT PRIMARY KEY,
          stock_id             INT          NOT NULL,
          cooperative_user_id  INT          NOT NULL,
          recipient_name       VARCHAR(160) NOT NULL,
          recipient_identifier VARCHAR(120) NULL,
          location             VARCHAR(160) NULL,
          quantity             INT          NOT NULL,
          notes                VARCHAR(255) NULL,
          issued_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

          CONSTRAINT fk_distribution_stock FOREIGN KEY (stock_id) REFERENCES fertiliser_stock(id),
          CONSTRAINT fk_distribution_user  FOREIGN KEY (cooperative_user_id) REFERENCES users(id)
        )`
      );
      console.log('+ created distribution_records');
    }

    await ensureIndex(
      'distribution_records',
      'idx_distributions_stock',
      'CREATE INDEX idx_distributions_stock ON distribution_records(stock_id)'
    );
    await ensureIndex(
      'distribution_records',
      'idx_distributions_user',
      'CREATE INDEX idx_distributions_user ON distribution_records(cooperative_user_id)'
    );

    console.log('Done. Cooperative distribution support is ready.');
    process.exit(0);
  } catch (err) {
    console.error('Distribution migration failed:', err);
    process.exit(1);
  }
}

migrate();
