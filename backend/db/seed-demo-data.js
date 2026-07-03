// =====================================================================
// Demo data seed
// Adds realistic stock, transfer, recall, and custody-history records for
// presentations. Run after npm run seed.
// =====================================================================

const db = require('../config/db');
const { generateQrImage } = require('../utils/qr');

const NATIONAL_SUPPLIER_NAME = 'National Cereals and Produce Board (NCPB)';

function dateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function timestampOffset(days, hour = 9) {
  return `${dateOffset(days)} ${String(hour).padStart(2, '0')}:00:00`;
}

async function loadUsers() {
  const rows = await db.query(
    `SELECT id, email, name, role
     FROM users
     WHERE email IN (?, ?, ?)`,
    ['supplier@demo.com', 'depot@demo.com', 'coop@demo.com']
  );
  const byEmail = Object.fromEntries(rows.map((user) => [user.email, user]));
  const missing = ['supplier@demo.com', 'depot@demo.com', 'coop@demo.com']
    .filter((email) => !byEmail[email]);

  if (missing.length) {
    throw new Error(`Missing demo users: ${missing.join(', ')}. Run npm run seed first.`);
  }

  return {
    supplier: byEmail['supplier@demo.com'],
    depot: byEmail['depot@demo.com'],
    coop: byEmail['coop@demo.com'],
  };
}

function demoBatches(users) {
  return [
    {
      batch_number: 'DEMO-NPK-2026-001',
      fertiliser_type: 'NPK 23:23:0',
      quantity: 300,
      manufacture_date: dateOffset(-90),
      expiry_date: dateOffset(540),
      source: NATIONAL_SUPPLIER_NAME,
      destination: 'Nakuru Depot',
      responsible_personnel: NATIONAL_SUPPLIER_NAME,
      status: 'registered',
      current_holder_id: users.supplier.id,
      holdings: [{ user_id: users.supplier.id, quantity: 300 }],
      transfers: [],
      recalls: [],
      custody: [
        [users.supplier.id, 'registered', 'Demo batch registered by NCPB.', -9, 9],
      ],
    },
    {
      batch_number: 'DEMO-DAP-2026-002',
      fertiliser_type: 'DAP',
      quantity: 240,
      manufacture_date: dateOffset(-80),
      expiry_date: dateOffset(500),
      source: NATIONAL_SUPPLIER_NAME,
      destination: 'Nakuru Depot',
      responsible_personnel: NATIONAL_SUPPLIER_NAME,
      status: 'in_transit',
      current_holder_id: users.supplier.id,
      holdings: [{ user_id: users.supplier.id, quantity: 160 }],
      transfers: [
        {
          from_user_id: users.supplier.id,
          to_user_id: users.depot.id,
          quantity: 80,
          status: 'dispatched',
          dispatched_at: timestampOffset(-4, 10),
          received_at: null,
          delivery_condition: null,
        },
      ],
      recalls: [],
      custody: [
        [users.supplier.id, 'registered', 'Demo batch registered by NCPB.', -6, 8],
        [users.supplier.id, 'dispatched', '80 bag(s) dispatched to Depot Demo.', -4, 10],
      ],
    },
    {
      batch_number: 'DEMO-CAN-2026-003',
      fertiliser_type: 'CAN',
      quantity: 180,
      manufacture_date: dateOffset(-120),
      expiry_date: dateOffset(420),
      source: NATIONAL_SUPPLIER_NAME,
      destination: 'Nakuru Depot',
      responsible_personnel: NATIONAL_SUPPLIER_NAME,
      status: 'received',
      current_holder_id: users.depot.id,
      holdings: [{ user_id: users.depot.id, quantity: 180 }],
      transfers: [
        {
          from_user_id: users.supplier.id,
          to_user_id: users.depot.id,
          quantity: 180,
          status: 'received',
          dispatched_at: timestampOffset(-8, 11),
          received_at: timestampOffset(-7, 15),
          delivery_condition: 'sealed intact',
        },
      ],
      recalls: [],
      custody: [
        [users.supplier.id, 'registered', 'Demo batch registered by NCPB.', -10, 8],
        [users.supplier.id, 'dispatched', '180 bag(s) dispatched to Depot Demo.', -8, 11],
        [users.depot.id, 'received', '180 bag(s) received from NCPB. Condition: sealed intact.', -7, 15],
      ],
    },
    {
      batch_number: 'DEMO-NPK-2026-004',
      fertiliser_type: 'NPK 17:17:17',
      quantity: 100,
      manufacture_date: dateOffset(-140),
      expiry_date: dateOffset(390),
      source: NATIONAL_SUPPLIER_NAME,
      destination: 'Nairobi Depot',
      responsible_personnel: 'Depot Demo',
      status: 'received',
      current_holder_id: users.coop.id,
      holdings: [{ user_id: users.coop.id, quantity: 65 }],
      transfers: [
        {
          from_user_id: users.supplier.id,
          to_user_id: users.depot.id,
          quantity: 100,
          status: 'received',
          dispatched_at: timestampOffset(-12, 9),
          received_at: timestampOffset(-11, 14),
          delivery_condition: 'good',
        },
        {
          from_user_id: users.depot.id,
          to_user_id: users.coop.id,
          quantity: 100,
          status: 'received',
          dispatched_at: timestampOffset(-6, 10),
          received_at: timestampOffset(-5, 12),
          delivery_condition: 'good',
        },
      ],
      distributions: [
        {
          cooperative_user_id: users.coop.id,
          recipient_name: 'Kiambu Farmers Group',
          recipient_identifier: 'KFG-DEMO-001',
          location: 'Kiambu Cooperative Store',
          quantity: 35,
          notes: 'Demo issue to registered cooperative collection group.',
          issued_at: timestampOffset(-2, 11),
        },
      ],
      recalls: [],
      custody: [
        [users.supplier.id, 'registered', 'Demo batch registered by NCPB.', -14, 9],
        [users.supplier.id, 'dispatched', '100 bag(s) dispatched to Depot Demo.', -12, 9],
        [users.depot.id, 'received', '100 bag(s) received from NCPB. Condition: good.', -11, 14],
        [users.depot.id, 'dispatched', '100 bag(s) dispatched to Cooperative Demo.', -6, 10],
        [users.coop.id, 'received', '100 bag(s) received from Depot Demo. Condition: good.', -5, 12],
        [users.coop.id, 'issued', '35 bag(s) issued to Kiambu Farmers Group.', -2, 11],
      ],
    },
    {
      batch_number: 'DEMO-UREA-2026-005',
      fertiliser_type: 'Urea',
      quantity: 60,
      manufacture_date: dateOffset(-310),
      expiry_date: dateOffset(12),
      source: NATIONAL_SUPPLIER_NAME,
      destination: 'Nakuru Depot',
      responsible_personnel: 'Depot Demo',
      status: 'recalled',
      current_holder_id: users.depot.id,
      holdings: [{ user_id: users.depot.id, quantity: 60 }],
      transfers: [
        {
          from_user_id: users.supplier.id,
          to_user_id: users.depot.id,
          quantity: 60,
          status: 'received',
          dispatched_at: timestampOffset(-20, 8),
          received_at: timestampOffset(-19, 13),
          delivery_condition: 'partially damaged',
        },
      ],
      recalls: [{
        reason: 'Demo recall: damaged packaging discovered during depot inspection.',
        flagged_by: users.depot.id,
        flagged_at: timestampOffset(-2, 16),
      }],
      custody: [
        [users.supplier.id, 'registered', 'Demo batch registered by NCPB.', -22, 8],
        [users.supplier.id, 'dispatched', '60 bag(s) dispatched to Depot Demo.', -20, 8],
        [users.depot.id, 'received', '60 bag(s) received from NCPB. Condition: partially damaged.', -19, 13],
        [users.depot.id, 'recalled', 'Batch DEMO-UREA-2026-005 recalled. Reason: damaged packaging.', -2, 16],
      ],
    },
    {
      batch_number: 'DEMO-NPK-2026-006',
      fertiliser_type: 'NPK 23:23:0',
      quantity: 75,
      manufacture_date: dateOffset(-330),
      expiry_date: dateOffset(18),
      source: NATIONAL_SUPPLIER_NAME,
      destination: 'Nairobi Depot',
      responsible_personnel: NATIONAL_SUPPLIER_NAME,
      status: 'registered',
      current_holder_id: users.supplier.id,
      holdings: [{ user_id: users.supplier.id, quantity: 75 }],
      transfers: [],
      distributions: [],
      recalls: [],
      custody: [
        [users.supplier.id, 'registered', 'Demo batch nearing expiry registered for alert workflow.', -3, 10],
      ],
    },
  ];
}

async function seedBatch(conn, batch, users) {
  const [existing] = await conn.query(
    'SELECT id FROM fertiliser_stock WHERE batch_number = ?',
    [batch.batch_number]
  );
  if (existing.length) {
    console.log(`- ${batch.batch_number} already exists, skipping.`);
    return;
  }

  const [stockResult] = await conn.query(
    `INSERT INTO fertiliser_stock
      (batch_number, fertiliser_type, quantity, manufacture_date, expiry_date,
       source, destination, responsible_personnel, status, current_holder_id, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      batch.batch_number,
      batch.fertiliser_type,
      batch.quantity,
      batch.manufacture_date,
      batch.expiry_date,
      batch.source,
      batch.destination,
      batch.responsible_personnel,
      batch.status,
      batch.current_holder_id,
      users.supplier.id,
      timestampOffset(-24, 8),
    ]
  );
  const stockId = stockResult.insertId;

  const payload = `FTRC-${batch.batch_number}-demo`;
  const imagePath = await generateQrImage(payload);
  await conn.query(
    'INSERT INTO qr_codes (stock_id, qr_payload, qr_image_path) VALUES (?, ?, ?)',
    [stockId, payload, imagePath]
  );

  for (const holding of batch.holdings) {
    await conn.query(
      'INSERT INTO stock_holdings (stock_id, user_id, quantity) VALUES (?, ?, ?)',
      [stockId, holding.user_id, holding.quantity]
    );
  }

  for (const transfer of batch.transfers) {
    await conn.query(
      `INSERT INTO transfers
        (stock_id, from_user_id, to_user_id, quantity, dispatched_at, received_at,
         delivery_condition, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        stockId,
        transfer.from_user_id,
        transfer.to_user_id,
        transfer.quantity,
        transfer.dispatched_at,
        transfer.received_at,
        transfer.delivery_condition,
        transfer.status,
      ]
    );
  }

  for (const distribution of batch.distributions || []) {
    await conn.query(
      `INSERT INTO distribution_records
        (stock_id, cooperative_user_id, recipient_name, recipient_identifier,
         location, quantity, notes, issued_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        stockId,
        distribution.cooperative_user_id,
        distribution.recipient_name,
        distribution.recipient_identifier,
        distribution.location,
        distribution.quantity,
        distribution.notes,
        distribution.issued_at,
      ]
    );
  }

  for (const recall of batch.recalls) {
    await conn.query(
      'INSERT INTO recall_records (stock_id, reason, flagged_by, flagged_at) VALUES (?, ?, ?, ?)',
      [stockId, recall.reason, recall.flagged_by, recall.flagged_at]
    );
  }

  for (const [userId, action, notes, days, hour] of batch.custody) {
    await conn.query(
      'INSERT INTO custody_log (stock_id, user_id, action, notes, created_at) VALUES (?, ?, ?, ?, ?)',
      [stockId, userId, action, notes, timestampOffset(days, hour)]
    );
  }

  console.log(`+ seeded ${batch.batch_number}`);
}

async function seedDemoData() {
  const users = await loadUsers();
  const conn = await db.pool.getConnection();

  try {
    await conn.beginTransaction();
    for (const batch of demoBatches(users)) {
      await seedBatch(conn, batch, users);
    }
    await conn.commit();
    console.log('\nDone. Demo stock, movement, recall, and report data is ready.');
    process.exit(0);
  } catch (err) {
    await conn.rollback();
    console.error('Demo data seed failed:', err);
    process.exit(1);
  } finally {
    conn.release();
  }
}

seedDemoData();
