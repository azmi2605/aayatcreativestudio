# Aayat Creative Studio — Official Website & Studio Portal

> **"You sell the product. We design the impact."**  
> Bespoke commercial advertising, editorial poster design, and distinctive social brand identities for forward-thinking brands.

- **Instagram:** [@aayatcreativestudio](https://instagram.com/aayatcreativestudio)
- **Direct Inquiries:** `aayatcreativestudio@gmail.com`

---

## 🏛️ Technical Philosophy & Constraints

This platform is engineered under strict architectural constraints to guarantee zero build steps, instant load times, and long-term maintainability:

- **Frontend:** Pure HTML5, Vanilla CSS with custom design tokens, and native JavaScript ES modules (`<script type="module">`). Zero bundlers (no Vite, Webpack, or Babel), zero heavy frameworks (no React, Next.js, or Vue), zero compilers.
- **Backend & Database:** [Supabase](https://supabase.com/) (PostgreSQL with Row Level Security, Storage Buckets, and Deno TypeScript Edge Functions).
- **Hosting:** [Cloudflare Pages](https://pages.cloudflare.com/) (Static multi-page architecture with edge caching).

---

## 📁 Repository Directory Structure

```text
aayatcreativestudio/
├── contracts/                        # Single source of truth for validation & schemas
│   └── enquiry-contract.json         # Strict JSON Schema & test vectors for contact briefs
├── scripts/                          # Automation and operational scripts
│   ├── setup-db.js                   # Schema migration runner (reads DATABASE_URL from .env)
│   ├── create-admin.js               # Creates the portal account and grants admin access
│   ├── verify-sync.js                # Admin write -> client read end-to-end checks
│   └── verify-client.mjs             # Renders the client modules against a stubbed database
├── site/                             # Public website and admin portal assets
│   ├── index.html                    # Homepage with dynamic hero, offers banner & featured work
│   ├── 404.html                      # Branded accessible error fallback page
│   ├── _headers                      # Cloudflare security and cache-control headers
│   ├── robots.txt & sitemap.xml      # Search engine indexing and SEO configuration
│   ├── about/index.html              # Studio story, philosophy & creative capabilities
│   ├── contact/index.html            # Client brief submission form with interactive multi-category pills
│   ├── work/
│   │   ├── index.html                # Filterable portfolio gallery (filters come from the shared list)
│   │   └── item.html                 # Individual project showcase page with stacked media
│   ├── admin/
│   │   ├── index.html                # Studio portal login interface
│   │   └── dashboard.html            # Admin dashboard: Product catalog & offer banner manager
│   ├── assets/                       # Static brand logos and seed portfolio assets
│   ├── css/
│   │   ├── tokens.css                # Design system variables (colors, typography, spacing)
│   │   ├── base.css                  # Typography, reset, and container layout rules
│   │   └── components/               # Modular component styles (buttons, header, footer)
│   └── js/
│       ├── config.js                 # Hostname-aware environment configuration
│       ├── admin/
│       │   ├── dashboard.js          # Admin CRUD logic for products, storage & offers
│       │   ├── login.js              # Supabase Auth sign-in
│       │   └── supabase-client.js    # Lazy-loaded Supabase SDK wrapper
│       ├── api/
│       │   └── portfolio.js          # Public data access (Supabase, localStorage mirror as offline fallback)
│       └── pages/                    # Individual page modules (home, work, contact, etc.)
├── supabase/
│   ├── SETUP_RUN_IN_SUPABASE.sql     # Idempotent complete schema & storage bootstrap script
│   ├── migrations/                   # Sequential version-controlled database migrations
│   └── functions/
│       ├── _shared/                  # Edge function CORS and strict validation helpers
│       ├── submit-enquiry/           # Project brief intake Edge Function (multi-category & notification toggle)
│       ├── retry-notifications/      # Scheduled background worker for retrying unsent notifications
│       ├── deno.d.ts                 # Ambient Deno and URL-import type definitions for TypeScript
│       ├── deno.json                 # Deno runtime & compiler options for Supabase CLI
│       └── tsconfig.json             # Scoped TypeScript configuration for Edge Functions
├── .env.example                      # Template for private environment variables
└── package.json                      # Development scripts and project metadata
```

---

## ⚡ Quick Start & Local Development

### Prerequisites
- Node.js 18+ (for local file serving and DB scripts) or Python 3+

### 1. Run the Development Server
You can launch the site locally using any static HTTP server pointing to the `site/` folder:

```bash
# Using npm
npm run dev

# Or directly using npx serve
npx serve site -l 3000

# Or using Python 3
python -m http.server --directory site 3000
```

Open your browser to:
- **Client Website:** [http://localhost:3000](http://localhost:3000)
- **Admin Portal:** [http://localhost:3000/admin/](http://localhost:3000/admin/)
- **Contact Brief:** [http://localhost:3000/contact/](http://localhost:3000/contact/)

### 2. Verify Code Syntax & Type Checking
Run the built-in syntax check across all JavaScript modules:
```bash
npm run check
```

Type-check Edge Functions without errors:
```bash
npx -p typescript tsc --project supabase/functions/tsconfig.json
```

---

## 🔄 Admin Portal & Client Site — One Shared Source of Truth

Supabase is the single source of truth. Everything the admin portal creates —
categories, designs, images and offers — is written to the database and read
back by the client site on the next page load. There is no separate "saved in
this browser" copy that can drift from what visitors actually see.

```text
Admin Portal (/admin/)                Client Site (/work/, /, /work/item.html)
        │                                       ▲
        │  sign in (Supabase Auth)              │  read (anonymous, published rows only)
        ▼                                       │
   ┌─────────────────────┐         ┌─────────────────────┐
   │  Supabase Postgres  │────────▶│  portfolio_items    │
   │  + Storage bucket   │         │  portfolio_images   │
   │  + categories       │         │  categories         │
   │  + site_settings    │         │  site_settings      │
   └─────────────────────┘         └─────────────────────┘
```

**Shared category list.** The filter bar on the work page is built from the
`categories` table, so a category added in the portal appears on the client
site without a code change — and removing it there removes the filter button.

**Offer tags.** The offer/tag field on a design is stored in
`portfolio_items.offer_tag` and rendered on both the work grid and the home
page.

**Published only.** The client site reads published rows. A draft stays in the
portal and never reaches a visitor.

**No invented content.** An empty database renders an empty state, never
placeholder projects. The previous hard-coded seed items are gone.

### Features
1. **Promotional Offers & Announcement Bar:**
   - Create, toggle, and delete promotional deals (discount codes, special seasonal packages).
   - Changes immediately reflect in the top notification banner on the homepage.
2. **Product & Creative Showcase Management:**
   - Add new creative projects with title, client name, category, description, and custom offer tags.
   - Direct image upload to Supabase Storage (`portfolio` bucket) with local preview.
   - Publish / Draft toggle (only published works appear on the public site).
   - Delete items (removes from Supabase database and storage).
3. **Category Management:**
   - Add a category and it becomes a filter on the client site right away.
   - A category still used by a design cannot be removed by accident.

### Accessing the Portal
Navigate to `/admin/` and sign in with the studio owner's Supabase Auth
account. There is no bypass link — a session is granted only when Supabase
confirms the credentials **and** the database reports the account as an
administrator (`private.admin_users`).

---

## 🗄️ Supabase Backend & Database Setup

The project is pre-configured to connect to the Supabase cloud backend in `site/js/config.js`.

### 1. Apply the schema
```bash
npm run db:setup
```
This executes `supabase/SETUP_RUN_IN_SUPABASE.sql` over a direct PostgreSQL
connection. The connection string is read from `DATABASE_URL` in your local
`.env` — never from a file in the repository.

To apply it by hand instead: open
`https://supabase.com/dashboard/project/<your-project-id>/sql/new`, paste
`supabase/SETUP_RUN_IN_SUPABASE.sql`, and click **Run**.

### 2. Create the admin account
```bash
npm run admin:create
```
This creates the Supabase Auth user and writes its ID into
`private.admin_users`, which is what `is_admin()` checks. It reads
`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` from
your local `.env`. Running it again resets the password of the existing
account.

### 3. Verify the whole path
```bash
npm run verify
```
This signs in as the admin, writes a category, a design and a file through the
same calls the portal makes, reads them back as an anonymous visitor, and
removes the test rows. It also checks that an anonymous caller can no longer
write to the database.

### Local environment file
Copy `.env.example` to `.env` and fill in the values. `.env` is gitignored.

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@<pooler-host>:5432/postgres
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=<at least 12 characters>
```

### Schema Overview
- `site_settings`: Singleton table storing studio metadata, social handles, and active `offers_json`.
- `portfolio_items`: Creative projects with slug, category, client brand, description, offer tag, and publication status.
- `portfolio_images`: Image assets linked to portfolio items with storage paths and dimensions.
- `categories`: The shared category list used by both the portal and the client site.
- `enquiries`: Client project brief submissions with contact information, `service` (primary enum), `services` (`TEXT[]` multi-category array), and `notified_at` status tracking.
- `private.admin_users`: The administrators. `is_admin()` checks this table.
- `storage.buckets`: Public `portfolio` bucket for image uploads.
- **Row Level Security (RLS):** All tables enforce strict RLS policies — public reads for published content, admin-only writes behind `is_admin()`.

### Account recovery
If the owner cannot sign in:
1. Open the Supabase Dashboard → **Authentication → Users**.
2. Reset the password of the admin account, or delete it and re-run
   `npm run admin:create`.
3. The `private.admin_users` row is keyed to the account ID, so recreating the
   account means re-running the script.

---

## 📩 Contact Brief & Edge Function Pipeline

Client inquiries submitted on `/contact/` follow an abuse-protected, resilient processing pipeline:

```text
Visitor submits Brief (/contact/)
        │
        ├─► 1. Client-Side Validation (UUID v4, Honeypot check, Field limits)
        │
        └─► 2. HTTPS POST to Supabase Edge Function (submit-enquiry)
                │
                ├─► Method, Origin & Content-Type Check
                ├─► Payload Size Guard (<= 16 KB)
                ├─► Multi-Category Extraction & Canonical Normalization
                ├─► Strict Whitelist Validation (contracts/enquiry-contract.json)
                ├─► Database Persistence (public.enquiries table)
                │
                ├─► 3. Notification Engine (with Multi-Level Toggles)
                │       ├─► Check Env Toggle (NOTIFICATIONS_ENABLED)
                │       ├─► Check Request Toggle (payload.notify / disableNotification)
                │       ├─► Check Header Override (X-Disable-Notification)
                │       └─► If ON: Dispatches background email via Resend & updates notified_at
                │
                └─► 4. Instant 200 OK Response (with submissionId)
```

### 🏷️ Multi-Category Selection
Clients can choose multiple creative focus areas simultaneously:
- **Available Categories:** `Ad Creatives` (`ad_creatives`), `Poster Design` (`poster_design`), `Social Media Design` (`social_media_design`), and `Other Creative Work` (`other`).
- **Flexible Input Acceptance:** The API accepts an array (`"services": ["ad_creatives", "poster_design"]`), category aliases (`"categories": ["ads", "posters"]`), a comma-separated string, or a legacy single string.
- **Storage:** Persisted as `services TEXT[]` in PostgreSQL while keeping `service` (enum) populated for backward compatibility.
- **Interactive UI:** The `/contact/` form features modern interactive pills with instantaneous visual feedback.

### 🔔 Configurable Notification Toggles
Studio owners and developers can toggle notifications on or off at three distinct levels:

1. **Global / Environment Toggle:**
   Set in Supabase Vault or environment variables:
   ```env
   NOTIFICATIONS_ENABLED=true   # Set to false, 0, or off to disable all notifications
   ```
2. **Per-Request Payload Toggle:**
   Pass `"notify": false` or `"disableNotification": true` in the JSON request body (ideal for automated end-to-end tests or administrative entries).
3. **HTTP Header Toggle:**
   Include `X-Disable-Notification: true` or `X-Send-Notification: false` in the request headers.

When enabled and Resend credentials (`RESEND_API_KEY`, `NOTIFY_EMAIL_TO`, `MAIL_FROM`) are present, a formatted project brief email is dispatched to the studio owner in the background and sets `notified_at = now()` on the enquiry record.

### 🔁 Scheduled Notification Retry (`retry-notifications`)
If an email notification fails due to an external network glitch or rate limit, the `retry-notifications` edge function picks up any unnotified enquiries from the last 7 days and retries delivery in batches of 20. Secured by an `X-Cron-Secret` header for automated execution via `pg_cron`.

---

## 💻 Editor & TypeScript Setup (VS Code / Antigravity)

Supabase Edge Functions execute on the **Deno** runtime in the cloud, while the web frontend runs on native browser JavaScript. The workspace is pre-configured to provide optimal developer experience without editor warnings:

1. **TypeScript Definitions:**
   - [`supabase/functions/deno.d.ts`](supabase/functions/deno.d.ts) provides ambient definitions for `Deno.serve`, `Deno.env`, and URL-based imports (`https://esm.sh/...`).
   - [`supabase/functions/tsconfig.json`](supabase/functions/tsconfig.json) ensures zero red squiggles for TypeScript editors.
2. **Scoping Deno Extension:**
   - [`.vscode/settings.json`](.vscode/settings.json) isolates the Deno language server strictly to `./supabase/functions`, ensuring it does not interfere with standard web frontend code.
   - Recommended extension: `denoland.vscode-deno`.

---

## 🚀 Deployment to Cloudflare Pages

This site is optimized for zero-configuration deployment to Cloudflare Pages:

1. Connect your GitHub repository to Cloudflare Pages.
2. Configure the build settings:
   - **Framework preset:** `None`
   - **Build command:** *(leave empty)*
   - **Build output directory:** `site`
3. Environment variables (set in Cloudflare Pages dashboard or Supabase Vault):
   - Review `.env.example` for optional secret configurations.
4. Deploy! Your site will be live globally across Cloudflare's edge network.

---

## 📄 License & Attribution

&copy; 2026 Aayat Creative Studio. All rights reserved.  
Designed with aesthetic precision and engineered for performance.
