// One-time/idempotent migration for self-service password reset tokens.

const db = require('../config/db');

async function tableExists(tableName) {
  const rows = await db.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [tableName]
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function indexExists(tableName, indexName) {
  const rows = await db.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    [tableName, indexName]
  );
  return Number(rows[0]?.count || 0) > 0;
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
    if (await tableExists('password_reset_tokens')) {
      console.log('- password_reset_tokens already exists');
    } else {
      await db.query(
        `CREATE TABLE password_reset_tokens (
          id         INT AUTO_INCREMENT PRIMARY KEY,
          user_id    INT       NOT NULL,
          token_hash CHAR(64)  NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          used_at    TIMESTAMP NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

          CONSTRAINT uq_password_reset_token_hash UNIQUE (token_hash),
          CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(id)
        )`
      );
      console.log('+ created password_reset_tokens');
    }

    await ensureIndex(
      'password_reset_tokens',
      'idx_password_reset_user',
      'CREATE INDEX idx_password_reset_user ON password_reset_tokens(user_id)'
    );
    await ensureIndex(
      'password_reset_tokens',
      'idx_password_reset_expires',
      'CREATE INDEX idx_password_reset_expires ON password_reset_tokens(expires_at)'
    );

    console.log('Done. Password reset database support is ready.');
    process.exit(0);
  } catch (err) {
    console.error('Password reset migration failed:', err);
    process.exit(1);
  }
}

migrate();
