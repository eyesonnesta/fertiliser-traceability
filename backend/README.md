# Fertiliser Traceability System - Backend

Express + MySQL backend for the QR Code Fertiliser Traceability System for
Kenya's National Fertiliser Subsidy Programme.

## What's Included

- Authentication with JWT, bcrypt password hashing, active-account checks, token invalidation, and role-based access control.
- Security headers, restricted CORS, request-size limits, login rate limiting, and API rate limiting.
- Admin-only user management for creating and activating/deactivating accounts.
- Stock registration with QR code generation and the first custody-log event.
- Partial stock dispatch using `stock_holdings`, so a holder can send part of a batch and retain the rest.
- Transfer workflow for dispatch, QR verification, and receipt confirmation.
- Cooperative issue/distribution records for final-mile stock release to groups or farmers.
- Expiry alerts and recall recording with custody evidence.
- Reporting endpoints for stock summaries, custody audit events, and CSV export.

## Prerequisites

- Node.js 18+ and npm
- MySQL installed and running locally

## Setup

1. Install dependencies:

   ```bash
   cd backend
   npm install
   ```

2. Create the database:

   ```bash
   mysql -u root -p < db/schema.sql
   ```

3. Create `.env` from `.env.example` and fill in your MySQL password and JWT secret:

   ```bash
   cp .env.example .env
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

4. Seed demo users:

   ```bash
   npm run seed
   ```

5. Seed realistic demo stock, movement, recall, and reporting records:

   ```bash
   npm run seed:demo
   ```

6. If you are upgrading an older database from before partial dispatch support:

   ```bash
   npm run migrate:partial-dispatch
   ```

7. If you are upgrading an older database from before cooperative issue support:

   ```bash
   npm run migrate:distributions
   ```

8. If you are upgrading an older database from before security hardening:

   ```bash
   npm run migrate:security
   ```

## Run

```bash
npm run dev
# or
npm start
```

Server runs at `http://localhost:5000`. Confirm with:

```bash
curl http://localhost:5000/api/health
```

## Demo Accounts

All seeded accounts use password `Demo@12345`.
If the demo users already existed with an older password, rerun `npm run seed`
after `npm run migrate:security`; the seed script refreshes the demo account
hashes and keeps them active.

| Role | Email |
| --- | --- |
| National Supplier | `supplier@demo.com` |
| Depot Manager | `depot@demo.com` |
| Cooperative Official | `coop@demo.com` |
| System Administrator | `admin@demo.com` |

## API Quick Reference

All protected routes require `Authorization: Bearer <token>`.

**Auth**

- `POST /api/auth/login`
- `POST /api/auth/register` - system administrator only
- `PATCH /api/auth/password`
- `GET /api/auth/me`

**Users**

- `GET /api/users` - system administrator only
- `POST /api/users` - system administrator only
- `PATCH /api/users/:id/password` - system administrator only
- `PATCH /api/users/:id/status` - system administrator only

**Stock**

- `POST /api/stock` - national supplier only
- `GET /api/stock`
- `GET /api/stock/:id`
- `GET /api/stock/:id/qr`

**Transfers**

- `GET /api/transfers/recipients`
- `POST /api/transfers/dispatch`
- `POST /api/transfers/verify`
- `POST /api/transfers/receive`

**Cooperative Issue**

- `GET /api/distributions`
- `POST /api/distributions` - cooperative official only

**Recall & Expiry**

- `GET /api/recall/expiring`
- `GET /api/recall`
- `POST /api/recall/check-expiry`
- `POST /api/recall`

**Reports**

- `GET /api/reports/summary`
- `GET /api/reports/custody`
- `GET /api/reports/custody.csv`

Report filters supported by custody endpoints:

- `from=YYYY-MM-DD`
- `to=YYYY-MM-DD`
- `action=registered|dispatched|received|issued|expired|recalled`
- `stock_id=<id>`
- `limit=<1-250>` for JSON custody events

## Project Mapping

- Authentication module: `routes/auth.js`, `controllers/authController.js`, `middleware/auth.js`
- Stock registration and QR generation: `controllers/stockController.js`, `utils/qr.js`
- Transfer verification and receipt: `controllers/transferController.js`
- Cooperative issue/distribution: `controllers/distributionController.js`
- Expiry and recall management: `controllers/recallController.js`
- Reporting and audit export: `controllers/reportController.js`
- Account administration: `controllers/userController.js`
