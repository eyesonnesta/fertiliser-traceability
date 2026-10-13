# Future Works

This document records realistic future improvements for the QR Code Fertiliser
Traceability System. These items are intentionally separated from the current
implemented scope so the project documentation stays honest about what already
works and what should be improved in a later phase.

## 1. Production Deployment

The current system is ready for local demonstration and can be prepared for
deployment, but a production rollout should include a complete hosting plan.

Recommended work:

- Deploy the backend API to a managed Node.js host, VPS, or container platform.
- Deploy the frontend build to a static host or reverse-proxy setup.
- Provision a managed MySQL database or a secured self-hosted database.
- Configure HTTPS for both frontend and backend traffic.
- Move secrets into the hosting provider's environment-variable system.
- Add automated backup and restore procedures for the database.
- Add uptime monitoring for the API health endpoint.
- Document recovery steps for database, server, and deployment failures.

## 2. Configurable Frontend API URL

The frontend currently points to the local backend API. A production-ready build
should read the API base URL from environment configuration instead of relying
on a hard-coded local URL.

Recommended work:

- Add a Vite environment variable such as `VITE_API_BASE_URL`.
- Update the API client to read the configured base URL.
- Document local, staging, and production frontend environment files.
- Verify the frontend build against the deployed backend URL.

## 3. Stronger QR Integrity Controls

The current QR workflow links a QR code to a registered stock record. For a
production environment, QR data should be harder to forge, copy, or reuse
outside the expected workflow.

Recommended work:

- Sign QR payloads with a backend secret or asymmetric key.
- Include issued-at and batch identity metadata in the signed payload.
- Reject QR payloads that fail signature verification.
- Record scan attempts for suspicious or repeated verification activity.
- Add optional QR regeneration controls for damaged labels.
- Add clear audit events when a QR code is regenerated or invalidated.

## 4. Offline and Low-Connectivity Field Support

Depot and cooperative users may work in areas with unstable connectivity. A
future version should support safe offline data capture without creating
duplicate or conflicting custody records.

Recommended work:

- Add offline-first forms for receipt, dispatch, and issue preparation.
- Queue pending actions locally when the network is unavailable.
- Synchronise queued actions when connectivity returns.
- Detect conflicts before committing custody-changing actions.
- Make offline state visible to the user.
- Prevent final custody confirmation until the server validates the queued
  action.

## 5. Mobile Field Application

The current frontend is web-based. A dedicated mobile experience could improve
field usability for QR scanning, receipt confirmation, and cooperative issue
recording.

Recommended work:

- Build a progressive web app or mobile wrapper for field workflows.
- Optimise scanning for low-end Android devices.
- Add device camera permission guidance.
- Store minimal offline cache for pending field actions.
- Add mobile-friendly audit views for stock inspection.

## 6. Advanced Analytics

The existing reports provide operational summaries and custody exports. Future
analytics could support decision-making, fraud detection, and programme
performance monitoring.

Recommended work:

- Add trend charts for stock movement over time.
- Track average time spent at each supply-chain stage.
- Flag unusual dispatch patterns or repeated failed QR verification attempts.
- Add expiry-risk forecasting by depot and cooperative.
- Add stock ageing reports.
- Add district, county, or region-level aggregation if location data is
  available.

## 7. Notifications and Alerts

Expiry and recall workflows would be stronger if the system could actively
notify responsible users instead of requiring manual dashboard checks.

Recommended work:

- Send email alerts for near-expiry stock.
- Notify relevant holders when a recall is created.
- Add in-app notification counters.
- Add daily or weekly digest emails for administrators.
- Record notification delivery status for audit purposes.

## 8. Expanded Audit and Compliance Evidence

The system already records custody events. Later work can make the audit trail
more complete and easier to review during inspections.

Recommended work:

- Add immutable audit-event IDs.
- Capture actor, role, timestamp, source IP, and affected stock for every
  sensitive action.
- Add before-and-after values for account status and stock status changes.
- Add export formats beyond CSV, such as PDF audit summaries.
- Add reviewer notes for inspection findings.
- Add audit log retention settings.

## 9. Stronger Account Security

The current backend includes authentication, role checks, password hashing,
account state, token invalidation, and rate limiting. Future security work can
raise the system closer to production standards.

Recommended work:

- Add multi-factor authentication for administrators.
- Add configurable session lifetime and refresh-token rotation.
- Add administrator approval for sensitive account changes.
- Add password-reset email verification in production.
- Add account lockout review tools.
- Add security event reporting for failed logins and password changes.

## 10. External System Integration

In a larger rollout, the traceability system should not remain isolated from
other programme, procurement, inventory, or farmer-registration systems.

Recommended work:

- Add import support for approved supplier and depot lists.
- Add export APIs for programme reporting systems.
- Integrate with farmer or cooperative registries where legally permitted.
- Add webhooks for stock registration, dispatch, receipt, issue, and recall
  events.
- Define stable API versioning before third-party integrations are introduced.

## 11. Automated Test Coverage

The current verification process relies on syntax checks, audits, builds, and
manual workflow testing. Automated tests would reduce regression risk.

Recommended work:

- Add backend unit tests for controllers and utility functions.
- Add integration tests for auth, stock, transfers, recall, distributions, and
  reports.
- Add frontend component tests for critical forms.
- Add end-to-end tests for the main user journeys.
- Run tests in continuous integration on every push to `develop`.
- Store test evidence in the repository documentation.

## 12. Role and Permission Refinement

The current role model supports the main demonstration workflows. A production
programme may need more granular permissions.

Recommended work:

- Separate read-only auditors from operational users.
- Add county, region, depot, or cooperative scoping rules.
- Add permission groups instead of relying only on broad role labels.
- Add administrator controls for user assignment to supply-chain locations.
- Add approval workflows for high-risk actions such as recalls or large
  dispatches.

## 13. Data Quality Improvements

Reliable traceability depends on clean input data. Future work should reduce
inconsistent names, invalid quantities, and duplicate records.

Recommended work:

- Add controlled lists for fertiliser type, supplier, depot, and cooperative.
- Add duplicate batch warnings.
- Add stronger validation for expiry dates and quantities.
- Add import validation for bulk stock records.
- Add data correction workflows that preserve audit history.

## 14. Accessibility and Usability

The current interface supports the main operational flows. Later work should
include formal accessibility and usability review.

Recommended work:

- Run keyboard-only navigation checks.
- Improve screen-reader labels where needed.
- Verify colour contrast against WCAG guidance.
- Add clearer empty, loading, and error states.
- Test forms with realistic long names and narrow mobile screens.
- Add language support if the programme requires multilingual use.

## 15. Release Management

The repository currently uses `develop` for active work and `main` for stable
releases. Because the current instruction is not to merge into `main`, future
release promotion should be deliberate and documented.

Recommended work:

- Keep current changes on `develop` until final release approval.
- Record the exact verification evidence required before a future `main`
  promotion.
- Tag stable releases after approval.
- Keep release notes for each approved version.
- Avoid undocumented branch changes or emergency merges.

## Suggested Priority Order

1. Configurable frontend API URL.
2. Production deployment plan and environment hardening.
3. Automated backend and frontend regression tests.
4. Stronger QR signing and verification.
5. Audit-log expansion.
6. Notifications for expiry and recall.
7. Offline/mobile field support.
8. External system integration.
