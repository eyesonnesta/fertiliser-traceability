# QR Code Fertiliser Traceability System

A full-stack web application for tracking subsidised fertiliser stock across the
Kenyan agricultural supply chain. The system links each fertiliser batch to a
digital record and QR identifier so authorised users can register stock,
dispatch it, verify it on receipt, issue it to cooperative recipients, monitor
expiry risk, record recalls, and export custody evidence.

The project was developed for the National Fertiliser Subsidy Programme use
case, where accountability depends on clear movement history, controlled user
access, and auditable records from supplier level through depots and
cooperatives.

## Current Status

- Active development branch: `develop`.
- Stable branch: `main`.
- Current instruction: do not merge `develop` into `main` unless that is
  explicitly requested later.
- Presentation status: project presentation completed, with positive panel
  feedback.
- Repository state: both backend and frontend implementations are present in
  this repository, with separate setup notes under `backend/` and `frontend/`.

## Problem Statement

Subsidised fertiliser distribution can lose accountability when stock movement
is recorded manually, when custody changes are not verified, or when different
actors keep separate records that cannot be reconciled. These weaknesses can
make it difficult to confirm where a batch originated, who handled it, how much
stock remains with each actor, whether stock was issued to recipients, and
whether expired or recalled stock is still in circulation.

This system addresses that problem by giving each fertiliser batch a registered
digital identity, attaching QR-based inspection to that identity, and recording
every meaningful custody action in a central audit trail.

## Project Objectives

- Register fertiliser batches with structured stock details and QR identifiers.
- Track custody from national supplier to depot, cooperative, and final issue.
- Support partial dispatch so a holder can transfer part of a batch and retain
  the remaining quantity.
- Verify received stock using QR lookup before confirming custody changes.
- Record cooperative-level issue events for last-mile accountability.
- Monitor expiry dates and support recall recording.
- Provide filtered reports and CSV exports for review and audit evidence.
- Keep account creation, status changes, and role assignment under administrator
  control.

## Main Users

| User type | Responsibility |
| --- | --- |
| National Supplier | Registers stock and dispatches fertiliser to downstream actors. |
| Depot Manager | Receives stock, views depot-scoped holdings, and dispatches available quantities. |
| Cooperative Official | Receives cooperative-held stock and records final issue events. |
| System Administrator | Manages user accounts, account state, passwords, and access roles. |

## Core Features

### Authentication and Access Control

- JWT-based authentication.
- Bcrypt password hashing.
- Role-based protected routes.
- Active/inactive account checks.
- Administrator-controlled account creation and lifecycle.
- Password policy utilities and password-change support.
- Token invalidation support through backend-side token versioning.
- Login and API rate limiting.

### Stock Registration

- Supplier-only stock registration workflow.
- Fertiliser metadata capture including product details, quantity, batch
  number, source, and expiry date.
- QR code generation for each registered stock record.
- Initial custody log entry created when stock is registered.

### Custody Movement

- Quantity-aware dispatch flow.
- Partial dispatch support using backend stock holdings.
- Recipient lookup for valid downstream movement.
- QR verification before receipt confirmation.
- Receipt confirmation that moves custody to the receiving actor.
- Custody timeline support for stock detail inspection.

### Cooperative Issue

- Cooperative issue records for final-mile release.
- Recipient group or farmer-level issue notes.
- Quantity tracking against cooperative-held stock.
- Audit evidence for stock that has left cooperative custody.

### Expiry and Recall

- Expiry alert checks.
- Recall creation for affected stock.
- Recall status visibility.
- Custody evidence preserved for recalled or expired stock.

### Reporting

- Summary reporting for stock and movement status.
- Custody audit filtering by date, action, stock id, and result limit.
- CSV export for audit review.
- Dashboard visualisation for operational scanning.

## Technology Stack

| Layer | Tools |
| --- | --- |
| Frontend | React, Vite, React Router, Axios, Recharts, Lucide React, Tailwind/PostCSS |
| Backend | Node.js, Express, MySQL, JWT, bcryptjs, Helmet, express-rate-limit, QRCode, Nodemailer |
| Database | MySQL schema, migration scripts, seed scripts, demo-data scripts |
| Version control | Git and GitHub using `develop` as the active integration branch |

## Repository Layout

```text
fertiliser-traceability/
  backend/                 Express API, database schema, migrations, seed data
  frontend/                React/Vite interface
  docs/                    Workflow, testing, deployment, and future-work notes
  screenshots/             Screenshot evidence for project documentation
  chapter5_screenshots/    Chapter/report screenshot evidence when available
  README.md                Main project overview
  LICENSE
```

## Backend Overview

The backend is an Express API connected to MySQL. It owns authentication,
authorisation, stock records, holdings, transfers, cooperative issue events,
recall records, reports, and audit exports.

Important backend files:

- `backend/server.js` - Express app setup, security middleware, API routes, and
  health endpoint.
- `backend/config/db.js` - MySQL connection configuration.
- `backend/db/schema.sql` - database schema.
- `backend/db/seed.js` - seeded demo users.
- `backend/db/seed-demo-data.js` - realistic stock and movement demo data.
- `backend/controllers/*` - domain controller logic.
- `backend/routes/*` - API route definitions.
- `backend/middleware/auth.js` - authentication and role guard middleware.
- `backend/utils/qr.js` - QR generation utility.

Backend scripts:

```powershell
cd backend
npm.cmd install
npm.cmd run seed
npm.cmd run seed:demo
npm.cmd run migrate:partial-dispatch
npm.cmd run migrate:distributions
npm.cmd run migrate:security
npm.cmd run migrate:depot-scope
npm.cmd run migrate:must-change-password
npm.cmd start
```

Use migration scripts only when the target database needs that migration. For a
fresh local database, start with `backend/db/schema.sql`, then run the seed
scripts.

## Frontend Overview

The frontend is a React/Vite application that consumes the backend API at
`http://localhost:5000/api`. It provides protected role-specific workflows for
stock management, movement, reporting, recalls, and user administration.

Main frontend routes:

| Route | Purpose |
| --- | --- |
| `/dashboard` | Stock ledger, summary metrics, and operational charts. |
| `/register` | Supplier stock registration and QR creation. |
| `/movement` | Dispatch, QR verification, scanning, and receipt confirmation. |
| `/distribution` | Cooperative issue workflow. |
| `/recall` | Expiry alerts and recall actions. |
| `/reports` | Audit reports, filters, summary charts, and CSV export. |
| `/users` | System administrator account management. |
| `/stock/:id` | Batch detail, QR download, holdings, and custody history. |

Frontend scripts:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
npm.cmd run lint
npm.cmd run build
npm.cmd run preview
```

## Local Setup

### Prerequisites

- Node.js 18 or newer.
- npm.
- MySQL server.
- Git.

### 1. Clone and Select the Active Branch

```powershell
git clone https://github.com/eyesonnesta/fertiliser-traceability.git
cd fertiliser-traceability
git checkout develop
git status --short --branch
```

Work should continue on `develop`. Do not promote the current work into `main`
without a deliberate release decision.

### 2. Configure the Backend

```powershell
cd backend
npm.cmd install
copy .env.example .env
```

Edit `backend/.env` with local values:

```text
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=<your mysql password>
DB_NAME=fertiliser_traceability
JWT_SECRET=<strong random secret>
CLIENT_ORIGIN=http://localhost:5173
```

Create the database:

```powershell
mysql -u root -p < db/schema.sql
```

Seed demo users and optional demo stock:

```powershell
npm.cmd run seed
npm.cmd run seed:demo
```

Start the API:

```powershell
npm.cmd start
```

Health check:

```powershell
curl http://localhost:5000/api/health
```

### 3. Configure the Frontend

In a second terminal:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Open the Vite local URL, usually:

```text
http://localhost:5173
```

## Demo Accounts

Seeded accounts use password `Demo@12345`.

| Role | Email |
| --- | --- |
| National Supplier | `supplier@demo.com` |
| Depot Manager | `depot@demo.com` |
| Cooperative Official | `coop@demo.com` |
| System Administrator | `admin@demo.com` |

If demo accounts already existed from an older database state, run the security
migration and seed script again from `backend/` so the demo accounts are active
and use the expected password:

```powershell
npm.cmd run migrate:security
npm.cmd run seed
```

## API Summary

Protected endpoints require:

```text
Authorization: Bearer <token>
```

Main API groups:

| Area | Endpoints |
| --- | --- |
| Auth | `/api/auth/login`, `/api/auth/register`, `/api/auth/me`, password workflows |
| Users | `/api/users` administrator account-management routes |
| Stock | `/api/stock`, `/api/stock/:id`, `/api/stock/:id/qr` |
| Transfers | `/api/transfers/recipients`, `/api/transfers/dispatch`, `/api/transfers/verify`, `/api/transfers/receive` |
| Distributions | `/api/distributions` |
| Recall | `/api/recall`, `/api/recall/expiring`, `/api/recall/check-expiry` |
| Reports | `/api/reports/summary`, `/api/reports/custody`, `/api/reports/custody.csv` |

More backend details are in [backend/README.md](backend/README.md).

## Verification

Run backend checks from `backend/`:

```powershell
npm.cmd audit
node --check server.js
node --check controllers/authController.js
node --check controllers/stockController.js
node --check controllers/transferController.js
node --check controllers/distributionController.js
node --check controllers/recallController.js
node --check controllers/reportController.js
node --check controllers/userController.js
```

Run frontend checks from `frontend/`:

```powershell
npm.cmd run lint
npm.cmd run build
```

Manual verification should cover:

- Login with each seeded role.
- Supplier stock registration and QR generation.
- Batch detail view and QR download.
- Partial dispatch from one holder to another.
- QR verification and receipt confirmation.
- Cooperative issue recording.
- Expiry alert review and recall recording.
- Dashboard and report filtering.
- Custody CSV export.
- System administrator account creation, password reset, activation, and
  deactivation.

Detailed verification notes belong in [docs/TESTING.md](docs/TESTING.md).

## Branch and Collaboration Policy

This repository uses two long-lived branches:

- `develop` - active integration branch for current work.
- `main` - stable branch, only updated after explicit release approval.

Current policy:

- Keep working on `develop`.
- Do not create extra feature branches unless the workflow is changed
  explicitly.
- Do not merge into `main` as part of ordinary cleanup or documentation work.
- Keep frontend and backend commits scoped where possible.
- Use clear commit messages that name the module and action.

See [docs/GITHUB_WORKFLOW.md](docs/GITHUB_WORKFLOW.md) for the detailed GitHub
workflow.

## Deployment Readiness

The project is structured for deployment, but live deployment still depends on
hosting decisions, production database provisioning, environment variables, and
final release approval.

Deployment preparation includes:

- Creating production-safe backend environment variables.
- Using a strong `JWT_SECRET`.
- Restricting `CLIENT_ORIGIN` to the deployed frontend URL.
- Running migrations against the target database in the correct order.
- Building the frontend with `npm.cmd run build`.
- Serving the Vite build output through a static host or reverse proxy.
- Running the Express API behind a production process manager or hosting
  platform.

Deployment notes are maintained in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Security and Data Integrity Notes

- `.env` files must not be committed.
- Passwords are stored as hashes, not plain text.
- Role checks are enforced server-side.
- Account activation state is backend-owned.
- Custody-changing actions should be recorded in the audit trail.
- Partial dispatch must preserve remaining stock for the original holder.
- QR verification should confirm the batch identity before receipt.
- Production deployments should use HTTPS, restricted CORS, strong secrets, and
  database backups.

## Known Limitations

- The system is currently documented for local development and demonstration,
  not a confirmed production hosting environment.
- The frontend API base URL is currently hard-coded to the local backend URL in
  `frontend/src/api/client.js`.
- QR codes identify registered stock records, but future production use should
  add stronger anti-tamper controls.
- Manual verification evidence should be kept up to date as screenshots,
  terminal output summaries, and test notes are added.
- The current instruction is to keep the work on `develop` and avoid a `main`
  merge until explicitly approved.

## Future Work

Future enhancements are documented in [docs/FUTURE_WORKS.md](docs/FUTURE_WORKS.md).
The highest-value next steps are production deployment hardening, stronger QR
integrity controls, offline/mobile field support, richer analytics, automated
tests, and integration with external programme or inventory systems.

## Related Documentation

- [backend/README.md](backend/README.md) - backend setup, scripts, demo users,
  and API details.
- [frontend/README.md](frontend/README.md) - frontend setup and route overview.
- [docs/GITHUB_WORKFLOW.md](docs/GITHUB_WORKFLOW.md) - branch and collaboration
  workflow.
- [docs/TESTING.md](docs/TESTING.md) - verification checklist and evidence
  expectations.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) - deployment readiness notes.
- [docs/FUTURE_WORKS.md](docs/FUTURE_WORKS.md) - recommended future
  enhancements.

## Contributors

- Makau Robert Mwendwa - backend implementation and integration.
- Obino Ian Nyamosi - frontend implementation and interface design.

## License

See [LICENSE](LICENSE).
