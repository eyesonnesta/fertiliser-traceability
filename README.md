# QR Code Fertiliser Traceability System

A web-based traceability system for Kenya's National Fertiliser Subsidy Programme. The system links fertiliser stock records to QR identifiers so stock can be registered, transferred, received, issued, recalled, and audited across the supply chain.

## Problem Statement

Fertiliser distribution can suffer from fragmented records, weak custody visibility, manual verification, and limited audit evidence. This project provides a digital workflow for tracking fertiliser batches from national suppliers through depots and cooperatives to final issue.

## Objectives

- Register fertiliser stock batches with digital records and QR identifiers.
- Track custody movement between supply-chain actors.
- Support partial dispatch and receipt verification.
- Record cooperative-level distribution events.
- Monitor expiry and recall activity.
- Provide reporting and audit exports for accountability.

## Features

- Authentication, password controls, and role-based access.
- Admin-controlled user lifecycle management.
- Stock registration with QR code generation.
- Quantity-aware stock transfer workflow.
- Depot-scoped stock visibility controls.
- Cooperative distribution recording.
- Expiry alerts and recall management.
- Audit reports and CSV export.

## Technologies Used

- Frontend: React, Vite, Axios, React Router, Recharts, Tailwind/PostCSS.
- Backend: Node.js, Express, MySQL, JWT, bcrypt, Helmet, rate limiting, QR code generation.
- Version control: Git and GitHub fork/pull workflow.

## Folder Structure

```text
fertiliser-traceability/
  backend/        Express API, database schema, migrations, seed scripts
  frontend/       React/Vite user interface
  docs/           GitHub workflow, testing evidence, deployment notes
  screenshots/    Demo screenshots for documentation
  README.md
  .gitignore
  LICENSE
```

## Setup

Backend setup is documented in [backend/README.md](backend/README.md).

Frontend setup will be documented in `frontend/README.md` once the frontend implementation is migrated into this repository.

## GitHub Collaboration Workflow

This project uses two long-lived branches:

- `main` - stable final version.
- `develop` - active integration branch.

Obino owns frontend commits. Robert owns backend commits. Work is committed in small module-based slices on `develop`, then the verified version is merged into `main`.

Detailed workflow notes are in [docs/GITHUB_WORKFLOW.md](docs/GITHUB_WORKFLOW.md).

## Testing

Testing evidence should include backend syntax checks, dependency audits, frontend build/lint checks, and manual workflow verification. See [docs/TESTING.md](docs/TESTING.md).

## Deployment Readiness

Deployment notes are maintained in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). The project is prepared for a Node/Express backend with a MySQL database and a Vite-built frontend.

## Known Limitations

- The repository is being migrated from an already-built working system into a clean Sprint 2B GitHub structure.
- Live deployment may require hosting-specific environment variables and database provisioning.
- Screenshots and final testing evidence should be added after both frontend and backend have been migrated.

## Contributors

- Makau Robert Mwendwa - backend implementation and integration.
- Obino Ian Nyamosi - frontend implementation and interface design.

## License

See [LICENSE](LICENSE).
