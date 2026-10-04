# AGENTS.md

Guidance for AI coding tools working in this repository.

## Project
Unique Futsal: a futsal booking and management website. This repo is the **frontend only** (Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, TanStack Query). There is no database or backend here.

All data (customers, credentials, bookings, memberships, inventory, gameplay totals) lives behind a separate REST API at `NEXT_PUBLIC_API_URL` (default `http://localhost:5000/api`). The backend is a separate project.

## Commands
- `npm install` : install dependencies
- `npm run dev` : dev server at http://localhost:3000
- `npm run build` : production build (run before finishing larger changes)
- `npm run lint` : ESLint

## Layout
- `app/` : routes. Public pages at the top level; the admin panel is under `app/uniquesuperadmin/`.
- `components/` : UI, grouped by area (`auth`, `dashboard`, `home`, `layout`, `membership`, `ui`).
- `lib/api/` : one API client file per domain (`auth`, `bookings`, `membership`, `inventory`, ...). Add new endpoint calls here.
- `lib/hooks/` : TanStack Query hooks per domain. Components should use these rather than calling `fetch` directly.
- `lib/utils/` : helpers, including PDF/invoice generators.
- `constants/` : static config such as membership and promo-code data.
- `FRD/` : functional requirement documents for planned features. Read the relevant FRD before implementing a feature.

## Rules
1. **Never touch production data.** Do not point `NEXT_PUBLIC_API_URL` at a production API for development or testing. Use a local or staging backend, or mock data.
2. **Do not commit secrets.** `.env*` files are git-ignored. Never hard-code API keys, tokens or passwords.
3. **Keep the API contract stable.** Existing endpoints, request shapes and response fields are used by the live backend. Make changes additive (new fields and endpoints). Do not rename or remove existing ones without confirming with the backend owner.
4. **Features that need new backend data** (new fields, endpoints, collections) must be written up as an FRD in `FRD/` and flagged. Do not assume the backend supports them.
5. Match existing patterns: follow the structure of nearby files, use existing hooks and UI components in `components/ui/`, and keep TypeScript types accurate.
6. Keep changes focused. Do not refactor unrelated code or delete the `.old` files in `lib/hooks/` without being asked.
7. Run `npm run lint` and `npm run build` before declaring work complete.

## Deployment
Production is an existing hosted site on the owner's domain. Do not deploy, and do not change hosting or DNS. Deploys are done by the owner after testing locally. Deploy any backend change first, then the frontend.
