# Testing Evidence

This file records the verification expected before the final `develop` to `main` merge.

## Backend Checks

Run from `backend/`:

```powershell
npm.cmd install
npm.cmd audit
node --check server.js
node --check controllers/authController.js
node --check controllers/stockController.js
node --check controllers/transferController.js
node --check controllers/recallController.js
node --check controllers/reportController.js
node --check controllers/userController.js
```

## Frontend Checks

Run from `frontend/` after the frontend is migrated:

```powershell
npm.cmd install
npm.cmd run lint
npm.cmd run build
```

## Manual Workflow Checks

- Login with seeded demo users.
- Register stock and confirm QR generation.
- Dispatch part of a batch and confirm remaining stock is retained.
- Verify and receive stock at the next actor.
- Record cooperative distribution.
- Review expiry alerts and create a recall.
- Export custody audit CSV.

## Evidence To Add

- Screenshots of key workflows in `screenshots/`.
- Terminal output summaries for build, lint, audit, and syntax checks.
- Notes for any known test gaps or environment limitations.
