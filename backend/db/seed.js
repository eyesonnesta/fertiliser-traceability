// =====================================================================
// Seed script
// Creates one demo user per role so you can log in immediately for demos.
// Run AFTER importing schema.sql:   npm run seed
// =====================================================================

const db = require("../config/db");
const { hashPassword } = require("../utils/auth");

const demoUsers = [
  {
    name: "National Supplier - NCPB",
    email: "supplier@demo.com",
    role: "national_supplier",
    depot_scope: null,
  },
  {
    name: "Nairobi Depot Manager",
    email: "depot@demo.com",
    role: "depot_manager",
    depot_scope: "Nairobi Depot",
  },
  {
    name: "Nakuru Depot Manager",
    email: "depot.nakuru@demo.com",
    role: "depot_manager",
    depot_scope: "Nakuru Depot",
  },
  {
    name: "Nairobi Cooperative Official",
    email: "coop@demo.com",
    role: "cooperative_official",
    depot_scope: "Nairobi Depot",
  },
  {
    name: "Nakuru Cooperative Official",
    email: "coop.nakuru@demo.com",
    role: "cooperative_official",
    depot_scope: "Nakuru Depot",
  },
  {
    name: "System Administrator",
    email: "admin@demo.com",
    role: "system_administrator",
    depot_scope: null,
  },
];

const PASSWORD = "Demo@12345"; // demo only - change for any real use

async function columnExists(tableName, columnName) {
  const rows = await db.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName],
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function seed() {
  try {
    const hasTokenVersion = await columnExists("users", "token_version");
    const hasPasswordChangedAt = await columnExists("users", "password_changed_at");
    const hasDepotScope = await columnExists("users", "depot_scope");
    const hasMustChangePassword = await columnExists("users", "must_change_password");

    for (const u of demoUsers) {
      const existing = await db.query("SELECT id FROM users WHERE email = ?", [
        u.email,
      ]);
      const hash = await hashPassword(PASSWORD);
      if (existing.length > 0) {
        const updates = [
          "name = ?",
          "password_hash = ?",
          "role = ?",
          "is_active = TRUE",
        ];
        const params = [u.name, hash, u.role];
        if (hasTokenVersion) {
          updates.push("token_version = token_version + 1");
        }
        if (hasPasswordChangedAt) {
          updates.push("password_changed_at = NOW()");
        }
        if (hasDepotScope) {
          updates.push("depot_scope = ?");
          params.push(u.depot_scope);
        }
        if (hasMustChangePassword) {
          updates.push("must_change_password = FALSE");
        }
        params.push(u.email);
        await db.query(
          `UPDATE users SET ${updates.join(", ")} WHERE email = ?`,
          params,
        );
        console.log(`~ refreshed ${u.email} (${u.role})`);
        continue;
      }
      if (hasDepotScope) {
        if (hasMustChangePassword) {
          await db.query(
            "INSERT INTO users (name, email, password_hash, role, depot_scope, must_change_password) VALUES (?, ?, ?, ?, ?, FALSE)",
            [u.name, u.email, hash, u.role, u.depot_scope],
          );
        } else {
          await db.query(
            "INSERT INTO users (name, email, password_hash, role, depot_scope) VALUES (?, ?, ?, ?, ?)",
            [u.name, u.email, hash, u.role, u.depot_scope],
          );
        }
      } else {
        await db.query(
          "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
          [u.name, u.email, hash, u.role],
        );
      }
      console.log(`+ created ${u.email} (${u.role})`);
    }
    console.log(`\nDone. All demo accounts use password: ${PASSWORD}`);
    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  }
}

seed();
