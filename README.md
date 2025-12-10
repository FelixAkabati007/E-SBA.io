# E-SBA [JHS]

E-SBA is a lightweight web application for managing Junior High School assessment workflows: master student database, subject assessment sheets, and printable report cards.

## Changelog

- 2025-12-08: Disabled client-side "Download Template" functionality across assessment sheets. The button remains visible for UI consistency but will no longer initiate any downloads or network requests. This change preserves all other assessment features and was implemented to enforce a site-wide policy and avoid generating Excel files that some clients (Excel 2016) reject due to strict OOXML merge validation. See `server/services/templates.ts` for validation fixes.

# E-SBA [JHS]

E-SBA is a lightweight web application for managing Junior High School assessment workflows: master student database, subject assessment sheets, and printable report cards.

## Setup

- Install Node.js 18+.
- Install dependencies: `npm install`.
- Start dev server: `npm run dev` and open `http://localhost:5173/`.

## Build & Deploy

- Production build: `npm run build`.
- Preview locally: `npm run preview`.
- Deploy the `dist/` folder to any static host (Netlify, Vercel, GitHub Pages, Nginx).

## Testing

- Typecheck: `npm run typecheck`.
- Unit/integration tests: `npm test`.
- E2E tests: start dev server (`npm run dev`) and run `npm run e2e` in another terminal.

## CI/CD

GitHub Actions workflow runs typecheck, tests, and build on pushes/PRs to `main`.

## API

The app is currently client-side only and does not expose an API. Import/Export uses local files and generates Excel/PDF on the client.

### Blob Storage (Vercel)

- Endpoint: `POST /api/blob/put`
  - Query/body:
    - `path`: path like `articles/blob.txt`
    - `access`: `public` | `private` (default `public`)
    - `file` (multipart) or `content` (string)
  - Env: `BLOB_READ_WRITE_TOKEN` (or `VERCEL_BLOB_RW_TOKEN`)
  - Response: `{ ok: true, url }`

## Security

- Validates image types and sizes for logo upload.
- Restricts Excel upload to `.xlsx`/`.xls` and handles parse errors gracefully.
- No secrets stored or transmitted; all processing occurs in the browser.

## Database Cleanup

- To purge all student-related seed/test data while preserving schema:
  - Backup and clean: `npm run db:clean`
    - Creates JSON backups under `server/backups/` for `students`, `assessments`, `academic_sessions`, `audit_logs`
    - Runs transactional deletes and verifies zero counts
    - Resets auto-increment for `assessments`, `audit_logs`, `academic_sessions`
  - Quick reset (non-transactional): `npm run db:reset`
    - Executes SQL truncation and auto-increment reset
  - Configure DB connection via env vars `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME` (defaults in `server/lib/db.ts`)

## Notes

- Excel/PDF generation uses `xlsx` and `jspdf` with `jspdf-autotable`.
- Tailwind CSS powers the UI styling.
