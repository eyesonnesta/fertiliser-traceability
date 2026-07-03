// =====================================================================
// Idempotent migration for first-login password change enforcement.
// Adds users.must_change_password. Existing users default to FALSE so
// live accounts are not unexpectedly blocked; newly-created users are
// marked TRUE by account creation code.
// Run from backend/:  node db/migrate-must-change-password.js
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

async function migrate() {
  try {
    const hasMustChangePassword = await columnExists('users', 'must_change_password');
    if (!hasMustChangePassword) {
      await db.query(
        'ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE AFTER token_version'
      );
      console.log('+ added users.must_change_password');
    } else {
      console.log('- users.must_change_password already exists');
    }

    await db.query(
      `UPDATE users
       SET must_change_password = FALSE
       WHERE must_change_password IS NULL`
    );
    console.log('+ normalized existing password-change flags');

    console.log('Done. First-login password change support is ready.');
    process.exit(0);
  } catch (err) {
    console.error('Must-change-password migration failed:', err);
    process.exit(1);
  }
}

migrate();
