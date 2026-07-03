# Deployment Readiness

The project is structured for deployment even if the final live environment is selected later.

## Backend

- Runtime: Node.js 18+.
- Server: Express API.
- Database: MySQL.
- Required environment file: `backend/.env`, based on `backend/.env.example`.

Typical production steps:

```powershell
cd backend
npm.cmd install --omit=dev
npm.cmd start
```

## Frontend

- Runtime/build tool: Vite.
- Output: static files from `npm run build`.
- Candidate hosts: Netlify, Vercel, shared hosting, VPS, or a reverse-proxy setup beside the backend.

Typical production build:

```powershell
cd frontend
npm.cmd install
npm.cmd run build
```

## Environment Notes

- Do not commit `.env` files.
- Configure database credentials in the hosting environment.
- Use a strong `JWT_SECRET`.
- Restrict `CLIENT_ORIGIN` to the deployed frontend URL.

## Final Release Checklist

- `develop` has been verified.
- Secrets are not committed.
- README setup instructions are current.
- Testing evidence has been added.
- Verified `develop` has been merged into `main`.
