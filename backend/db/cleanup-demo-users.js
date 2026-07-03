// =====================================================================
// Demo user cleanup
// Refreshes the required demo accounts and deactivates known test accounts
// without deleting them, preserving traceability and audit links.
// Run from backend/:  node db/cleanup-demo-users.js
// =====================================================================

const db = require('../config/db');

const REQUIRED_USERS = [
  {
    name: 'National Supplier - NCPB',
    email: 'supplier@demo.com',
    role: 'national_supplier',
    depot_scope: null,
  },
  {
    name: 'Nairobi Depot Manager',
    email: 'depot@demo.com',
    role: 'depot_manager',
    depot_scope: 'Nairobi Depot',
  },
  {
    name: 'Nakuru Depot Manager',
    email: 'depot.nakuru@demo.com',
    role: 'depot_manager',
    depot_scope: 'Nakuru Depot',
  },
  {
    name: 'Nairobi Cooperative Official',
    email: 'coop@demo.com',
    role: 'cooperative_official',
    depot_scope: 'Nairobi Depot',
  },
  {
    name: 'Nakuru Cooperative Official',
    email: 'coop.nakuru@demo.com',
    role: 'cooperative_official',
    depot_scope: 'Nakuru Depot',
  },
  {
    name: 'System Administrator',
    email: 'admin@demo.com',
    role: 'system_administrator',
    depot_scope: null,
  },
];

const KNOWN_TEST_EMAILS = [
  'admin-check-20260617155644@demo.com',
  'ian.obino@strathmore.edu',
  'mwendwar14@gmail.com',
  'mwendwar363@gmail.com',
];

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

async function cleanup() {
  try {
    const hasDepotScope = await columnExists('users', 'depot_scope');
    const hasTokenVersion = await columnExists('users', 'token_version');
    const hasMustChangePassword = await columnExists('users', 'must_change_password');
    const knownTestPlaceholders = KNOWN_TEST_EMAILS.map(() => '?').join(', ');

    const deactivateUpdates = ['is_active = FALSE'];
    if (hasTokenVersion) {
      deactivateUpdates.push('token_version = token_version + 1');
    }

    const deactivateResult = KNOWN_TEST_EMAILS.length
      ? await db.query(
        `UPDATE users
         SET ${deactivateUpdates.join(', ')}
         WHERE email IN (${knownTestPlaceholders})
           AND is_active = TRUE`,
        KNOWN_TEST_EMAILS
      )
      : { affectedRows: 0 };

    for (const user of REQUIRED_USERS) {
      const updates = [
        'name = ?',
        'role = ?',
        'is_active = TRUE',
      ];
      const params = [user.name, user.role];

      if (hasDepotScope) {
        updates.push('depot_scope = ?');
        params.push(user.depot_scope);
      }
      if (hasMustChangePassword) {
        updates.push('must_change_password = FALSE');
      }

      params.push(user.email);
      await db.query(
        `UPDATE users
         SET ${updates.join(', ')}
         WHERE email = ?`,
        params
      );
    }

    const activeUsers = await db.query(
      `SELECT id, name, email, role, depot_scope
       FROM users
       WHERE is_active = TRUE
       ORDER BY role, depot_scope, email`
    );

    console.log(`Deactivated extra active users: ${deactivateResult.affectedRows || 0}`);
    console.log(JSON.stringify(activeUsers, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Demo user cleanup failed:', err);
    process.exit(1);
  }
}

cleanup();
