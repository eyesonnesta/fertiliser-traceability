const db = require('../config/db');

async function columnExists(tableName, columnName) {
  const rows = await db.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function migrate() {
  try {
    const hasTokenVersion = await columnExists('users', 'token_version');
    if (!hasTokenVersion) {
      await db.query(
        'ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 0 AFTER is_active'
      );
      console.log('+ added users.token_version');
    } else {
      console.log('- users.token_version already exists');
    }

    const hasPasswordChangedAt = await columnExists('users', 'password_changed_at');
    if (!hasPasswordChangedAt) {
      await db.query(
        'ALTER TABLE users ADD COLUMN password_changed_at TIMESTAMP NULL AFTER token_version'
      );
      console.log('+ added users.password_changed_at');
    } else {
      console.log('- users.password_changed_at already exists');
    }

    process.exit(0);
  } catch (err) {
    console.error('Security hardening migration failed:', err);
    process.exit(1);
  }
}

migrate();
