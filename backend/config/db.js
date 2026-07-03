// =====================================================================
// Database connection
// We use a "connection pool" rather than a single connection. A pool
// keeps several reusable connections open, which is faster and safer
// when many requests come in at once. mysql2's promise API lets us
// use async/await instead of callbacks.
// =====================================================================

const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,      // max simultaneous connections
  queueLimit: 0,
});

// Small helper so other files can just `db.query(sql, params)`.
// Using parameterised queries (the `?` placeholders) protects against
// SQL injection - user input is never glued directly into the SQL string.
module.exports = {
  query: async (sql, params) => {
    const [rows] = await pool.query(sql, params);
    return rows;
  },
  pool,
};
