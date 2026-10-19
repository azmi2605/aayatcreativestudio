# Aayat Creative Studio Website

Bespoke commercial advertising, editorial poster design, and distinctive social brand identities.

## Tech Stack Constraints (Strict)
- **Frontend:** Pure HTML5, Vanilla CSS (with design tokens), and native JavaScript ES modules (`<script type="module">`). Zero bundlers, zero frameworks, zero compilers.
- **Backend:** Supabase (PostgreSQL with Row Level Security, Auth, Storage, Edge Functions in JavaScript).
- **Hosting:** Cloudflare Pages (Static multi-page architecture).

## Directory Structure
- `site/`: All public and admin HTML, CSS, JavaScript, and static assets.
- `supabase/`: Migrations, functions, and seed data.
- `contracts/`: Single source of truth for validation schemas and test vectors.
- `docs/`: System documentation (PRD, DESIGN, ARCHITECTURE, DATABASE, API, AGENTS).

## Local Development
To view the website locally, run any static file server pointing at the `site/` directory:
```bash
npx serve site
```
or with Python:
```bash
python -m http.server --directory site 3000
```
Open `http://localhost:3000` in your browser.
