# Fertiliser Traceability - Frontend

React + Vite + Tailwind CSS frontend for the QR Code Fertiliser Traceability
System.

## What's Included

- Login and protected application shell.
- Stock ledger dashboard with status summaries and fertiliser breakdown chart.
- Stock registration with QR generation.
- Batch detail view with QR download, holdings, and custody timeline.
- Stock movement page for dispatch, QR verification, camera scanning, and receipt confirmation.
- Cooperative issue page for recording final-mile stock release to recipient groups or farmers.
- Alerts and recall page for expiry checks and recall recording.
- Reports page with summary charts, filtered custody audit table, and CSV export.
- System administrator user-management page.

## Prerequisites

- Backend running at `http://localhost:5000`
- Node.js 18+ and npm

## Setup & Run

```bash
cd frontend
npm install
npm run dev
```

Open the local URL Vite prints, usually `http://localhost:5173`.

## Demo Accounts

Use the seeded backend accounts:

- National Supplier: `supplier@demo.com` / `Demo@12345`
- Depot Manager: `depot@demo.com` / `Demo@12345`
- Cooperative Official: `coop@demo.com` / `Demo@12345`
- System Administrator: `admin@demo.com` / `Demo@12345`

For a populated demo, run `npm run seed` and `npm run seed:demo` in the backend.

## Main Pages

- `/dashboard` - stock ledger and summary metrics
- `/register` - register stock, supplier only
- `/movement` - dispatch and receive stock
- `/distribution` - issue cooperative-held stock, cooperative official only
- `/recall` - expiry alerts and recall actions
- `/reports` - audit and stock reports with CSV export
- `/users` - account administration, system administrator only
- `/stock/:id` - batch detail, QR, holdings, and custody history

## Backend Connection

`src/api/client.js` points at `http://localhost:5000/api` and attaches the JWT
from `localStorage` to protected requests. If the backend port changes, update
the `baseURL` there.
