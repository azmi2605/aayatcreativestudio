# ARCHITECTURE.md: Aayat Creative Studio Website

| Field      | Value                                                                                         |
|------------|-----------------------------------------------------------------------------------------------|
| Product    | Aayat Creative Studio (@aayatcreativestudio)                                                  |
| Depends on | PRD.md v0.1, DESIGN.md v0.2, DATABASE.md v0.1, API.md v0.1, AGENTS.md v0.1                     |
| Version    | 0.3 (Revised for plain HTML, CSS and JavaScript multi-page architecture on Supabase)           |
| Audience   | Owner and coding agent. This file defines exactly how the system is structured and built.     |

**Legend**

- `[ASSUMPTION]`: assumed because it was not specified. Correct it if wrong.
- `[DECISION NEEDED AD-n]`: the owner must approve before it is built. Defaults are in section 18.
- **MVP** means build now. **Future** means do not build until its stated trigger occurs (section 17).
- Supabase naming, limits, plan terms and prices change. Everything marked "verify at setup" must be checked against current Supabase documentation when the project is created.

**What changed in v0.3 (Plain HTML, CSS & JavaScript Multi-Page Architecture)**

- **Front-end architecture:** Replaced SPA client-side history router with a clean Multi-Page Application (MPA) using semantic HTML pages (`site/index.html`, `site/work/index.html`, `site/work/item.html`, `site/about/index.html`, `site/contact/index.html`, and `site/admin/*`).
- **Zero build step:** Public and admin web pages are served directly as plain static files from `site/` without compilation, bundling (Vite, Webpack) or transpilation.
- **Native ES modules:** Clean modular JavaScript using native browser ES module imports (`type="module"`).
- **Public data access:** Public reads use plain browser `fetch()` directly against the Supabase PostgREST Data API with the publishable key.
- **Admin client:** Admin routes load the vendored Supabase client (`site/js/lib/supabase.js`) exclusively for Auth, Storage, and admin Data API operations.
- **Edge Functions in JavaScript:** Supabase Edge Functions (`submit-enquiry` and `retry-notifications`) are written in plain JavaScript executed on the Deno runtime, with zero external npm dependencies except the vendored Supabase client.
- **Folder structure:** Strictly aligned with AGENTS.md (`site/` root for web, `supabase/` for migrations/functions/tests, `contracts/` for contract JSON).
- **Security hardening & private schema:** Internal tables (`rate_limits`, `admin_users`) are placed in a non-exposed `private` schema (DATABASE amendment A1).
- **Image pipeline format support:** Public storage bucket accepts both WebP and JPEG images to accommodate browsers (such as older Safari engines) without client-side WebP canvas encoding (DATABASE amendment A4).
- **Enquiry and notification resilience:** Form submission enforces a 16 KB payload cap, rejects unknown fields, echoes `submissionId`, and logs request IDs. Email retry job processes enquiries from the last 7 days in batches of 20 with `X-Cron-Secret` verification (API amendments A2–A4).

---

## 1. Architecture Summary

### 1.1 Principle

Use the least infrastructure that meets the PRD. This is an elegant, content-focused portfolio website for a creative studio with one owner/admin and exactly one public write endpoint (the enquiry form). That calls for a multi-page static front end, one managed Supabase project (Postgres, Auth, Storage, Edge Functions), and zero custom web servers or frameworks to maintain.

### 1.2 System at a glance

```
  Visitor / Admin                     Cloudflare Pages                  Supabase Project (one region)
  (browser)                           (static hosting, CDN, SSL)        ─────────────────────────────────────
        │                                    │                          Data API (PostgREST) ◄── RLS enforced
        ├── Load page (HTML/CSS/JS) ────────►│                            │
        │                                                               Postgres: portfolio, testimonials,
        ├── Read published content ─────────────────────────────────────►  site_settings (public schema)
        │   (fetch + publishable key)                                     │
        │                                                               Storage bucket: site-images
        ├── Fetch media (WebP/JPEG variants) ───────────────────────────► (public CDN delivery)
        │                                                                 │
        ├── Admin sign-in / reset / session ────────────────────────────► Supabase Auth (admin user only)
        │   (vendored client on /admin/*)                                 │
        │                                                               Edge Function: submit-enquiry
        └── Submit brief (JSON) ────────────────────────────────────────► (validate → honeypot → rate limit
            (fetch call from contact page)                                 → insert enquiry → email attempt)
                                                                          │
                                                                        pg_cron (every 10 min)
                                                                          └─► Edge Function: retry-notifications
                                                                               (sends unsent in 7-day window)
```

### 1.3 Key decisions at a glance

| Topic | Decision | Reference |
|-------|----------|-----------|
| Backend platform | Supabase (Postgres, Auth, Storage, Edge Functions) | PRD D1, ARCHITECTURE |
| Front end | Multi-page plain HTML5, CSS3, native Vanilla JS ES modules | PRD D9, AGENTS 2 |
| Build step | None. Direct static delivery from `site/` | AGENTS 2.5 |
| Routing | Multi-page (separate HTML files per route), no client SPA router | AGENTS 1, IMPLEMENTATION_PLAN |
| Public reads | Direct `fetch()` calls to Supabase PostgREST Data API under RLS | API 3, DATABASE 9 |
| Enquiry writes | Edge Function `submit-enquiry` only; browser has zero table insert rights | API 6, DATABASE 7.3 |
| Admin operations | Supabase client (`site/js/lib/supabase.js`) on `/admin/*` protected by RLS | API 7, DATABASE 7.3 |
| Media pipeline | Client-side resize and compression (WebP with JPEG fallback), public Storage | DESIGN 10, DATABASE 10 |
| Email notifications | Plain-text email via Resend REST API, with scheduled retry safety net | PRD FR-8, API 10 |
| AI | None in MVP | PRD 11.2 |

---

## 2. Technology Stack and Reasoning

| Layer | Choice | Why |
|-------|--------|-----|
| Markup | Plain semantic HTML5 | Maximizes accessibility, SEO, performance, and longevity without abstraction. |
| Styling | Vanilla CSS with Design Tokens (`tokens.css`, `base.css`) | 1:1 mapping to DESIGN.md tokens; zero runtime dependencies; instantly loads. |
| Client Scripting | Native ES Modules (`<script type="module">`) | Modern browser standard; native module scoping and imports; no bundler needed. |
| Database | Supabase PostgreSQL | Relational integrity, constraints, triggers, and Row Level Security (RLS). |
| Data Access | PostgREST Data API via standard `fetch()` (public) and Supabase client (admin) | Clean REST interface adhering to RLS policies without an intermediate Node server. |
| Authentication | Supabase Auth (Email + Password) | Robust session handling, token refresh, and secure password-reset flow for single admin. |
| File Storage | Supabase Storage (`site-images` public bucket) | Secure asset storage with CDN delivery, governed by Storage RLS policies. |
| Server Functions | Supabase Edge Functions (JavaScript on Deno runtime) | Secure boundary for input validation, rate limiting, and email dispatch with secrets. |
| Scheduling | `pg_cron` (Supabase extension) | Automated retry of unsent notifications and cleanup of expired rate-limit logs. |
| Email Delivery | Resend REST API | Lightweight, reliable transactional email with domain DKIM/SPF verification. |
| Static Hosting | Cloudflare Pages | Global edge CDN, free SSL, zero-cost commercial tier, instant rollback capability. |
| Analytics | Google Analytics 4 (GA4) | Privacy-aligned, event-based tracking with zero personal data collected. |
| Automated Testing | Node.js test runner, pgTAP, Playwright, axe-core | Thorough verification across database, API contracts, accessibility, and user journeys. |

### 2.1 Dependency policy

1. **Public pages:**
   - **Zero external libraries.**
   - All public reads use standard browser `fetch()` targeting the PostgREST Data API with the public anon key.
   - SVG icons (~14 icons) are inlined directly in markup with appropriate license attribution.
   - Fonts are self-hosted `.woff2` files stored in `site/assets/fonts/`.
2. **Admin pages:**
   - Single vendored script: `@supabase/supabase-js` (stored locally in `site/js/lib/supabase.js`).
   - Loaded strictly on pages under `site/admin/`. Never imported or executed on public visitor routes.
3. **Edge Functions:**
   - Pure JavaScript targeting the Supabase Deno runtime.
   - No external third-party npm or deno modules, except the official `@supabase/supabase-js` client for database operations using the service-role key.
4. **Explicitly forbidden:**
   - React, Vue, Svelte, Angular, jQuery, or any front-end framework.
   - Tailwind CSS, Bootstrap, or utility CSS libraries.
   - Bundlers or compilers (Vite, Webpack, Parcel, Rollup, Babel, Sass, Less).
   - Node runtime servers, Express, Fastify, GraphQL, ORMs (Prisma, Drizzle).

---

## 3. System Architecture

### 3.1 Frontend Architecture

**Shape:** A clean, multi-page static site structure where each document is an independent HTML file:
- Home: `site/index.html`
- Portfolio / Work List: `site/work/index.html`
- Item Detail: `site/work/item.html` (renders item specified by query parameter `?slug=...`)
- About Studio: `site/about/index.html`
- Contact & Brief: `site/contact/index.html`
- Admin Area: `site/admin/index.html`, `dashboard.html`, `portfolio/index.html`, `testimonials/index.html`, `enquiries/index.html`, `settings.html`, `reset.html`

**Architecture Layers:**
```
  Pages (site/js/pages/*.js)
    │   Page entry scripts orchestrating UI rendering and lifecycle
    ▼
  Components (site/js/components/*.js)
    │   Reusable UI modules (header, footer, modal, masonry, toast, cards)
    ▼
  API & Services (site/js/api/*.js)
    │   Encapsulated fetch and PostgREST calls for portfolio, testimonials, settings, brief
    ▼
  Lib & Config (site/js/lib/*, site/js/config.js)
        Runtime environment config, error mapping, image utilities, vendored client
```

**Client Communication Rules:**
- **Public reads:** Handled by `site/js/api/portfolio.js`, `testimonials.js`, and `settings.js` using native `fetch()` against the PostgREST endpoint with query string filters (`published=eq.true&order=sort_order.desc`).
- **Brief submission:** Handled by `site/js/api/enquiry.js` posting JSON to `https://<project-ref>.supabase.co/functions/v1/submit-enquiry`.
- **Admin operations:** Handled by `site/js/api/admin-*.js` using the authenticated vendored Supabase client.
- **Environment configuration:** `site/js/config.js` inspects `window.location.hostname` to provide the correct Supabase URL and anon publishable key (local dev, preview/dev, or production).

### 3.2 Backend Architecture (Supabase)

**Database schemas:**
- `public` schema: Contains user-facing entities (`portfolio_items`, `portfolio_images`, `testimonials`, `site_settings`, `enquiries`). Every table has Row Level Security (RLS) enabled and enforced.
- `private` schema: Contains internal operational entities (`private.rate_limits`, `private.admin_users`). Not exposed over PostgREST. Reachable only via internal security-definer database functions.

**Database logic (Postgres declarative rules & functions):**
- **Constraints & Enums:** Enforce valid categories, services, enquiry statuses, and text length limits mirroring the shared enquiry contract.
- **Triggers:**
  - Auto-generate slug on item insert from title; make slug immutable once published.
  - Reject publishing any portfolio item that lacks an image or alt text.
  - Maintain `updated_at` timestamps automatically.
- **Functions:**
  - `is_admin()`: Verifies if the authenticated caller's UID exists in `private.admin_users`.
  - `check_rate_limit(p_caller_hash, p_window_limit, p_daily_limit)`: Atomic rate-limit check and counter increment.
  - `move_portfolio_item(p_id, p_direction)` / `move_testimonial(p_id, p_direction)`: Atomic sort-order swap functions.

**Edge Functions (Server Logic):**

| Function | Trigger | Authentication | Primary Responsibility |
|----------|---------|----------------|------------------------|
| `submit-enquiry` | HTTPS POST from `site/contact/index.html` | Public (Anon key + CORS validation) | Payload size check (≤ 16 KB), honeypot check, field validation, caller IP hashing & rate limiting, database insertion, and background notification dispatch via Resend. |
| `retry-notifications` | HTTPS POST called by `pg_cron` every 10 min | Secured via `X-Cron-Secret` header | Scans for enquiries created within the last 7 days where `notified_at` is null. Sends email notifications in batches of up to 20 with exponential backoff on transient errors. |

### 3.3 Rendering, SEO, and Performance

- **Semantic HTML & Metadata:** Each HTML page contains unique `<title>`, meta description, canonical link, and Open Graph tags.
- **Dynamic Item Page:** `site/work/item.html` reads the `slug` query parameter, fetches the published item record, renders the content, and updates the document title (`{Item Title} — Aayat Creative Studio`) and Open Graph meta tags dynamically.
- **Performance Budget:** Target mobile Lighthouse Performance ≥ 85, LCP ≤ 2.5s on 4G.
  - Self-hosted Latin subset fonts (`site/assets/fonts/`).
  - Native browser responsive images (`<picture>` and `srcset`) using WebP/JPEG variants generated on upload.
  - Zero heavy JavaScript bundles; total public JS footprint is under 30 KB uncompressed.

---

## 4. Data Flow

### DF-1: Visitor Browses Portfolio & Content
1. Visitor requests `site/` or `site/work/`. Cloudflare Pages serves static HTML, CSS, and JS modules.
2. `site/js/pages/work.js` calls `site/js/api/portfolio.js`.
3. Client executes `fetch()` to `GET /rest/v1/portfolio_items?select=...,portfolio_images(...)&published=eq.true&order=sort_order.desc`.
4. Postgres executes the query under RLS; only published records and images are returned.
5. Items are cached in browser session memory. Filter navigation (`?category=...`) filters items in memory with instantaneous UI updates without refetching.
6. Images load from the public Storage bucket with responsive `srcset` widths.

### DF-2: Visitor Submits an Enquiry (Project Brief)
1. Visitor fills out the form at `site/contact/index.html`.
2. Form generates a client-side `submissionId` (UUID v4) on initial render.
3. Client validation checks all inputs against the contract rules (`contracts/enquiry-contract.json`).
4. On submit, form POSTs JSON payload to `submit-enquiry` Edge Function.
5. Edge Function verifies:
   - Origin matches allowed domains.
   - Content length ≤ 16 KB.
   - Honeypot field (`website`) is empty (if filled, returns 200 OK without saving).
   - Strict field validation; unknown fields return `400 Bad Request`.
   - Caller IP hashed with salt; `check_rate_limit()` verifies ≤ 5 submissions/hour and ≤ 100 global/day.
6. Edge Function inserts enquiry into `public.enquiries` with `submissionId` as primary key.
7. Function responds `200 OK` with `{ "ok": true, "submissionId": "..." }`. Contact page displays confirmation panel.
8. Function immediately invokes background email dispatch via Resend REST API to notify the owner. On success, updates `notified_at = now()`. If email fails, row remains stored with `notified_at = null`.
9. The scheduled `retry-notifications` function picks up any unnotified row within 10 minutes.

### DF-3: Admin Management & Image Pipeline
1. Admin signs in at `site/admin/index.html` using Supabase Auth.
2. Client queries `is_admin()`; if false, signs out immediately and shows invalid credentials.
3. In `site/admin/portfolio/`, admin creates or edits an item.
4. When images are selected, browser-side canvas decodes and compresses images to responsive WebP variants (and JPEG fallback if WebP encoding is unsupported).
5. Files are uploaded to `site-images` bucket under `portfolio/{item_id}/{variant}.webp`.
6. Database rows are created in `public.portfolio_images`.
7. Item is published. Database trigger verifies at least one image and non-empty alt text exist before allowing `published = true`.

---

## 5. Folder Structure

The repository structure matches AGENTS.md Section 1 exactly:

```
aayatcreativestudio/
├── docs/                           # Source-of-truth documents (never auto-generated)
│   ├── PRD.md
│   ├── DESIGN.md
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── API.md
│   ├── AGENTS.md
│   └── IMPLEMENTATION_PLAN.md
├── contracts/
│   └── enquiry-contract.json       # Field rules, enums, regexes, and test vectors
├── site/                           # Public-facing website (plain HTML, CSS, JS)
│   ├── index.html                  # Home page
│   ├── work/
│   │   ├── index.html              # Portfolio list page
│   │   └── item.html               # Portfolio item detail page (?slug=...)
│   ├── about/
│   │   └── index.html              # About studio page
│   ├── contact/
│   │   └── index.html              # Contact / brief submission page
│   ├── admin/                      # Protected admin portal (requires is_admin())
│   │   ├── index.html              # Admin sign-in
│   │   ├── dashboard.html          # Overview and quick actions
│   │   ├── portfolio/
│   │   │   ├── index.html          # Portfolio management & reordering
│   │   │   └── editor.html         # Portfolio item editor (create/edit)
│   │   ├── testimonials/
│   │   │   └── index.html          # Testimonials manager
│   │   ├── enquiries/
│   │   │   ├── index.html          # Enquiries inbox
│   │   │   └── detail.html         # Enquiry detail view
│   │   ├── settings.html           # Studio settings (tagline, social links)
│   │   └── reset.html              # Password reset page
│   ├── css/
│   │   ├── tokens.css              # Design tokens (colors, typography, spacing, elevations)
│   │   ├── base.css                # Global styles, resets, accessibility, reduced-motion
│   │   ├── components/             # Component stylesheets (buttons, cards, forms, modals)
│   │   └── pages/                  # Page-specific styling overrides
│   ├── js/
│   │   ├── config.js               # Dynamic public config by hostname (Supabase URL, anon key)
│   │   ├── api/                    # Data access layer (PostgREST fetch modules)
│   │   │   ├── portfolio.js
│   │   │   ├── testimonials.js
│   │   │   ├── settings.js
│   │   │   ├── enquiry.js
│   │   │   └── admin.js
│   │   ├── components/             # Reusable UI modules (header, footer, dialog, toast, etc.)
│   │   ├── pages/                  # Page entry modules (one per HTML page)
│   │   └── lib/                    # Vendored libraries (supabase.js for admin only)
│   │       └── supabase.js
│   └── assets/                     # Brand logos, icons, favicon, self-hosted fonts
│       ├── brand/
│       ├── fonts/
│       └── icons/
├── supabase/
│   ├── config.toml                 # Local Supabase CLI configuration
│   ├── migrations/                 # Forward-only SQL migrations
│   ├── seed.sql                    # Local development dummy data (never run in prod)
│   ├── functions/
│   │   ├── submit-enquiry/
│   │   │   └── index.js            # Enquiry submission Edge Function
│   │   └── retry-notifications/
│   │       └── index.js            # Email retry scheduled Edge Function
│   └── tests/                      # Database & RLS automated test suites (JavaScript / pgTAP)
├── scripts/                        # Development and CI utility scripts
│   ├── sync-contract.js            # Verifies contract sync across frontend and functions
│   ├── check-rls.js                # Verifies RLS is enabled on all public schema tables
│   └── verify-no-secrets.js        # Scans site/ files for forbidden secret patterns
├── .env.example                    # Variable NAMES only, zero real secrets
├── .gitignore
└── README.md                       # Setup, development, testing, and deployment instructions
```

---

## 6. Database Design & Security Specifications

### 6.1 Schemas & Tables

| Schema | Table | Primary Key | Purpose | PostgREST API Access |
|--------|-------|-------------|---------|----------------------|
| `public` | `portfolio_items` | `id` (UUID) + `slug` (unique) | Portfolio projects | Anon reads published; Admin full access |
| `public` | `portfolio_images` | `id` (UUID) | Responsive images & aspect ratios | Anon reads published items' images; Admin full access |
| `public` | `testimonials` | `id` (UUID) | Client quotes and reviews | Anon reads published; Admin full access |
| `public` | `site_settings` | `is_singleton` (bool PK = true) | Studio settings (singleton) | Anon reads; Admin updates |
| `public` | `enquiries` | `submission_id` (UUID) | Project enquiries / leads | Admin reads and updates `status` only. Insert via function. |
| `private`| `rate_limits` | `(caller_hash, bucket_window)` | IP rate limit counters | No API access (function access only) |
| `private`| `admin_users` | `user_id` (UUID FK auth.users) | Admin identity whitelist | No API access (checked by `is_admin()`) |

### 6.2 Key Database Rules and Triggers

1. **Singleton Settings:** `site_settings` uses `is_singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (is_singleton = TRUE)` to guarantee exactly one settings row.
2. **Slug Generation & Immutability:** On insert, a trigger generates `slug` from `title`. Collision handling appends an incrementing counter (`-1`, `-2`). Once `published` is true, a trigger prevents changes to `slug`.
3. **Publishing Validation Trigger:** Trigger prevents setting `published = TRUE` on `portfolio_items` unless at least one image exists in `portfolio_images` and `alt_text` is non-empty.
4. **Ordering & Swapping:** Items and testimonials have an integer `sort_order`. Reordering uses atomic stored procedures (`move_portfolio_item`, `move_testimonial`) that swap values within an isolated transaction.
5. **Enquiry Constraints:** Strict database check constraints match `contracts/enquiry-contract.json` (email format regex, phone characters, status enums, text length bounds).

### 6.3 Storage Architecture

- **Bucket:** `site-images` (public read via Supabase CDN).
- **MIME types allowed:** `image/webp`, `image/jpeg`.
- **Max file size:** 5 MB.
- **Write policy:** Insert, update, and delete restricted exclusively to users where `is_admin() = true`.
- **Paths:** Structured as `portfolio/{item_id}/{image_id}_{variant}.webp` and `testimonials/{id}.webp`.

---

## 7. Authentication & Authorization

### 7.1 Security Model

- **Anonymous Visitors:** Possess the public anon key. Gated strictly by PostgreSQL Row Level Security (RLS). Can read published content only. Cannot insert, update, or delete any record.
- **Studio Admin:** Authenticates via Supabase Auth (email/password). The database function `is_admin()` verifies that `auth.uid()` exists in `private.admin_users`.
- **Session Management:** Standard Supabase JWT session stored securely in `localStorage` by the vendored client on admin pages. Tokens refresh automatically.

### 7.2 RLS Policy Matrix

```sql
-- Conceptual policy rule summary:
-- Public reads:
CREATE POLICY "Public read published portfolio items" ON public.portfolio_items
  FOR SELECT TO anon, authenticated USING (published = true);

-- Admin full access:
CREATE POLICY "Admin full portfolio access" ON public.portfolio_items
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Enquiries:
CREATE POLICY "Admin read enquiries" ON public.enquiries
  FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "Admin update status only" ON public.enquiries
  FOR UPDATE TO authenticated USING (is_admin())
  WITH CHECK (is_admin() AND (SELECT count(*) FROM (SELECT old.name, old.email, old.brand_name EXCEPT SELECT new.name, new.email, new.brand_name)) = 0);
```

---

## 8. API Specifications

### 8.1 Public PostgREST Queries

- **PUB-1 (Site Settings):**
  `GET /rest/v1/site_settings?select=tagline,instagram_handle,contact_email,whatsapp_number,about_photo_path,about_photo_alt&limit=1`
- **PUB-2 (Portfolio List):**
  `GET /rest/v1/portfolio_items?select=id,slug,title,client_brand,category,description,alt_text,featured,sort_order,created_at,portfolio_images(id,storage_path,image_order,width,height,variants)&published=eq.true&order=sort_order.desc`
- **PUB-3 (Portfolio Item by Slug):**
  `GET /rest/v1/portfolio_items?select=id,slug,title,client_brand,category,description,alt_text,featured,sort_order,created_at,portfolio_images(id,storage_path,image_order,width,height,variants)&slug=eq.{slug}&published=eq.true`
  Header: `Accept: application/vnd.pgrst.object+json`
- **PUB-4 (Testimonials List):**
  `GET /rest/v1/testimonials?select=id,client_name,brand_name,quote,project_tag,image_path,image_alt,sort_order&published=eq.true&order=sort_order.desc`

### 8.2 Enquiry Submission (`submit-enquiry`)

- **Method:** `POST /functions/v1/submit-enquiry`
- **Headers:** `Content-Type: application/json`, `apikey: <anon_key>`
- **Payload Constraints:** Max 16 KB body size. Unknown fields rejected with `400 Bad Request`.
- **Services enum values on wire:** `ad_creatives`, `poster_design`, `social_media_design`, `other`.
- **Rate Limit:** 5 requests per hour per caller hash; 100 global submissions per day. Returns `429 Too Many Requests` when exceeded with `Retry-After` header.
- **Success Response:**
  ```json
  {
    "ok": true,
    "submissionId": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
  }
  ```

### 8.3 Notification Retry (`retry-notifications`)

- **Trigger:** Scheduled every 10 minutes via `pg_cron` calling `net.http_post()`.
- **Headers:** `X-Cron-Secret: <vault-secret>`
- **Batch Size:** Up to 20 unnotified enquiries per run.
- **Window:** Enquiries created within the last 7 days only (`created_at >= now() - interval '7 days'`). Older unnotified rows are flagged in the admin dashboard as "Email not sent".
- **Idempotency:** The enquiry ID is transmitted as Resend's idempotency key to prevent duplicate email delivery.

---

## 9. Environment Configuration & Secrets

### 9.1 Public Configuration (`site/js/config.js`)

Public settings are committed to `site/js/config.js` and resolved automatically by hostname:

```javascript
// site/js/config.js
const ENVIRONMENTS = {
  localhost: {
    supabaseUrl: 'http://127.0.0.1:54321',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', // local anon key
    siteUrl: 'http://localhost:3000'
  },
  preview: {
    supabaseUrl: 'https://dev-project.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    siteUrl: 'https://preview.aayatcreativestudio.pages.dev'
  },
  production: {
    supabaseUrl: 'https://prod-project.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    siteUrl: 'https://aayatcreativestudio.com'
  }
};
```

### 9.2 Server & Edge Function Secrets

Stored securely in Supabase Vault and Function Secrets (never in git):
- `RESEND_API_KEY`: Secret key for dispatching emails via Resend.
- `IP_HASH_SALT`: Cryptographic salt for anonymizing caller IP addresses in rate limits.
- `CRON_SECRET`: Shared secret header validating `retry-notifications` execution.
- `NOTIFICATION_EMAIL`: Owner inbox address (`aayatcreativestudio@gmail.com`).
- `NOTIFICATION_FROM`: Verified sender address (`notifications@aayatcreativestudio.com`).
- `RATE_LIMIT_PER_HOUR`: Max submissions per caller per hour (default: 5).
- `RATE_LIMIT_GLOBAL_PER_DAY`: Global daily submission ceiling (default: 100).
- `MAX_BODY_BYTES`: Max enquiry payload bytes (default: 16384).
- `NOTIFY_BATCH_SIZE`: Batch size for retry job (default: 20).
- `NOTIFY_RETRY_WINDOW_DAYS`: Retry window in days (default: 7).

---

## 10. Verification, Testing & Quality Gates

### 10.1 Testing Strategy

1. **Contract Tests:** Node.js tests validating that client validation rules and server Edge Function validation rules match `contracts/enquiry-contract.json` with zero drift.
2. **Database & Security Tests:** Executed against local Supabase instance:
   - RLS enforcement: Anonymous user cannot read private tables or unpublished items.
   - Triggers: Slug immutability, publishing alt-text and image requirements.
   - Stored procedures: Atomic reordering and rate-limiting counters.
3. **Edge Function Tests:** Automated tests mocking Resend API to verify input validation, honeypot handling, 16 KB body capping, rate limiting, and email dispatch.
4. **End-to-End Tests:** Playwright tests running against local static server (`npx serve site/`) validating visitor journeys (J1, J2) and admin workflows (J3, J4).
5. **Accessibility Scans:** Automated `axe-core` sweeps verifying WCAG 2.1 AA compliance across all public and admin pages.
6. **Secret Scanning:** CI pre-commit check verifying zero occurrences of `service_role` keys or secret patterns in `site/`.

### 10.2 Must-Pass Launch Gates

- [ ] All public tables have RLS enabled; `check-rls.js` passes.
- [ ] Anonymous users cannot access `enquiries`, `private.rate_limits`, or `private.admin_users`.
- [ ] Non-admin authenticated users receive zero admin permissions.
- [ ] Portfolio publishing fails without images or alt text.
- [ ] Slug generation works and slug remains immutable after publishing.
- [ ] `submit-enquiry` rejects invalid payloads, enforces 16 KB cap, respects honeypot, and rate limits abuse.
- [ ] Enquiry submission generates a notification email; failed emails retry via `retry-notifications`.
- [ ] Zero secrets exist in the `site/` folder or client commits.
- [ ] Lighthouse Performance score ≥ 85 and accessibility score = 100 on mobile viewports.

---

## 11. Deployment & Operations

### 11.1 Hosting & CDN Configuration

- **Hosting Platform:** Cloudflare Pages delivering static assets from the `site/` directory.
- **Routing:** Direct static multi-page routing. Clean URL handling for directory paths (`/work/` -> `/work/index.html`).
- **Security Headers (`_headers` file):**
  - Strict Content Security Policy (CSP) allowing only self, Supabase project URL, and GA4.
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### 11.2 Rollback & Recovery Procedures

- **Static Front End:** Instant one-click rollback in Cloudflare Pages dashboard to the prior green deployment.
- **Edge Functions:** Re-deploy previous commit via Supabase CLI.
- **Database:** Forward-only migrations. Backups managed automatically under the Supabase Pro plan.

---

## 12. Traceability Matrix

| Requirement | PRD Section | Architectural Delivery |
|-------------|-------------|------------------------|
| Visual Identity & Showcase | PRD FR-1, FR-2 | Multi-page static HTML, CSS custom properties, masonry layout with stored aspect ratios |
| Category Filtering | PRD FR-3, FR-4 | In-memory filtering of published items driven by URL query parameter `?category=` |
| Project Detail Showcase | PRD FR-6, FR-7 | Dedicated `site/work/item.html?slug={slug}` page, stacked responsive images, dynamic `<title>` |
| Services & Pricing Guide | PRD FR-5 | Static markup and structured content module in `site/about/` and `site/` |
| Project Brief Submission | PRD FR-8, FR-14, FR-15 | `submit-enquiry` Edge Function, contract-driven validation, honeypot, rate limiting |
| Reliable Lead Notification | PRD FR-8, NFR Reliability | Dual-stage pipeline: immediate email dispatch + 10-minute scheduled `retry-notifications` safety net |
| Studio Administration | PRD FR-18–FR-24 | Authenticated `/admin/` routes, client-side WebP/JPEG image pipeline, RLS-enforced CRUD |
| Accessibility & Performance | PRD NFR | Semantic HTML5, WCAG 2.1 AA tokens, zero framework overhead, self-hosted fonts |

---

## 13. Approved Architectural Decisions

| ID | Decision Topic | Approved Choice | Rationale |
|----|----------------|-----------------|-----------|
| AD-1 | Front-end Architecture | Plain HTML5, CSS3, native Vanilla JS ES modules (MPA) | Zero build overhead, blazing fast load times, long-term simplicity, meets owner constraint. |
| AD-2 | Routing Model | Multi-Page Application (independent HTML files) | Clean URL architecture without client-side routing complexity or SPA hydration overhead. |
| AD-3 | Scripting Languages | Plain JavaScript across frontend and Edge Functions | Eliminates compilation steps; native Deno and browser runtime execution. |
| AD-4 | Production Hosting & Plan | Supabase Pro Plan + Cloudflare Pages | Pro plan avoids free-tier project pausing and guarantees managed daily backups. |
| AD-5 | Database Region | `ap-south-1` (Mumbai) | Lowest latency for India-based studio owner and primary client demographic. |
| AD-6 | Static Web Host | Cloudflare Pages | Free tier allows commercial use, zero maintenance, global edge caching, fast rollbacks. |
| AD-7 | Email Notification Provider | Resend REST API | Clean HTTP API, high deliverability, simple API key management, generous free tier. |
| AD-8 | Image Format Handling | Client-side WebP with JPEG fallback | Broad compatibility across all browsers (including Safari); zero server image costs. |
| AD-9 | Admin Reordering | Up/Down button swaps via atomic DB functions | Simple, reliable, mobile-friendly UX without complex drag-and-drop dependencies. |
| AD-10| Enquiry Body & Rate Limits | 16 KB body limit, 5/hour per IP, 100/day global | Protects serverless resources and email quotas against automated flooding. |
| AD-11| Slug Generation | Database trigger on item insert (immutable once published) | Guaranteed uniqueness and permalink stability across social shares. |
| AD-12| Private Schema for Internal Tables | `private.rate_limits` and `private.admin_users` | Complete isolation from PostgREST API exposure; accessible only to internal functions. |
