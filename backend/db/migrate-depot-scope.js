// =====================================================================
// Idempotent migration for depot-scoped depot/cooperative routing.
// Adds users.depot_scope so each depot manager only dispatches to the
// cooperative official assigned under the same demo depot.
// Run from backend/:  node db/migrate-depot-scope.js
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

async function migrate() {
  try {
    const hasDepotScope = await columnExists('users', 'depot_scope');
    if (!hasDepotScope) {
      await db.query('ALTER TABLE users ADD COLUMN depot_scope VARCHAR(80) NULL AFTER role');
      console.log('+ added users.depot_scope');
    } else {
      console.log('- users.depot_scope already exists');
    }

    const hasDepotScopeIndex = await indexExists('users', 'idx_users_depot_scope');
    if (!hasDepotScopeIndex) {
      await db.query('CREATE INDEX idx_users_depot_scope ON users(role, depot_scope)');
      console.log('+ added idx_users_depot_scope');
    } else {
      console.log('- idx_users_depot_scope already exists');
    }

    await db.query(
      `UPDATE users
       SET depot_scope = CASE
         WHEN email IN ('depot@demo.com', 'coop@demo.com') THEN 'Nairobi Depot'
         WHEN email IN ('depot.nakuru@demo.com', 'coop.nakuru@demo.com') THEN 'Nakuru Depot'
         ELSE depot_scope
       END
       WHERE email IN (?, ?, ?, ?)`,
      ['depot@demo.com', 'coop@demo.com', 'depot.nakuru@demo.com', 'coop.nakuru@demo.com']
    );
    console.log('+ backfilled demo depot scopes');

    console.log('Done. Depot-scoped routing is ready.');
    process.exit(0);
  } catch (err) {
    console.error('Depot scope migration failed:', err);
    process.exit(1);
  }
}

migrate();
