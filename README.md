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
├── site/                             # Public website and admin portal assets
│   ├── index.html                    # Homepage with dynamic hero, offers banner & featured work
│   ├── 404.html                      # Branded accessible error fallback page
│   ├── _headers                      # Cloudflare security and cache-control headers
│   ├── robots.txt & sitemap.xml      # Search engine indexing and SEO configuration
│   ├── about/index.html              # Studio story, philosophy & creative capabilities
│   ├── contact/index.html            # Client brief submission form with live validation
│   ├── work/
│   │   ├── index.html                # Filterable portfolio gallery (Ads, Posters, Social Media)
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
│       │   ├── login.js              # Supabase Auth and session management
│       │   └── supabase-client.js    # Lazy-loaded Supabase SDK wrapper
│       ├── api/
│       │   └── portfolio.js          # 3-tier data access (Supabase -> LocalStorage -> Seed)
│       └── pages/                    # Individual page modules (home, work, contact, etc.)
├── supabase/
│   ├── SETUP_RUN_IN_SUPABASE.sql     # Idempotent complete schema & storage bootstrap script
│   ├── migrations/                   # Sequential version-controlled database migrations
│   └── functions/
│       ├── _shared/                  # Edge function CORS and strict validation helpers
│       └── submit-enquiry/           # Project brief intake Edge Function (Deno TypeScript)
├── .env.example                      # Template for private environment variables
└── package.json                      # Development scripts and project metadata
```

---

## ⚡ Quick Start & Local Development

### Prerequisites
- Node.js 18+ (for local file serving) or Python 3+

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

### 2. Verify Code Syntax
Run the built-in syntax check across all JavaScript modules:
```bash
npm run check
```

---

## 🔄 Admin Portal & Client Site Real-Time Synchronization

The admin dashboard provides full content management capabilities connected directly to Supabase and mirrored to the client site in real time.

### Features
1. **Promotional Offers & Announcement Bar:**
   - Create, toggle, and delete promotional deals (discount codes, special seasonal packages).
   - Changes immediately reflect in the top notification banner on the homepage.
2. **Product & Creative Showcase Management:**
   - Add new creative projects with title, client name, category, description, and custom offer tags.
   - Direct image upload to Supabase Storage (`portfolio` bucket) with local preview.
   - Publish / Draft toggle (only published works appear on the public site).
   - Delete items (removes from Supabase database and storage).
3. **3-Tier Resilient Data Flow:**
   ```text
   Admin Dashboard (adds/edits/deletes)
           │
           ├─► 1. Supabase Cloud Database & Storage (Authoritative)
           │
           └─► 2. localStorage Mirror (Instant cross-tab update without reloads)
                   │
                   ▼
           Client Site (home, work, item pages)
                   ├─► First priority: Supabase Cloud REST API
                   ├─► Second priority: localStorage mirror
                   └─► Third priority: Hard-coded seed data (offline fallback)
   ```

### Accessing the Portal
Navigate to `/admin/` in your browser. For local development, enter any email/password or click **"Enter Dashboard Directly"** to access the dashboard via local session authentication.

---

## 🗄️ Supabase Backend & Database Setup

The project is pre-configured to connect to the Supabase cloud backend in `site/js/config.js`.

### Running Migrations
To initialize a fresh database or update an existing Supabase project:
1. Open your Supabase Dashboard: `https://supabase.com/dashboard/project/<your-project-id>/sql/new`
2. Open [`supabase/SETUP_RUN_IN_SUPABASE.sql`](supabase/SETUP_RUN_IN_SUPABASE.sql) in this repository.
3. Paste the entire script into the Supabase SQL Editor and click **Run**.

### Schema Overview
- `site_settings`: Singleton table storing studio metadata, social handles, and active `offers_json`.
- `portfolio_items`: Creative projects with slug, category, client brand, description, and publication status.
- `portfolio_images`: Image assets linked to portfolio items with storage paths and dimensions.
- `enquiries`: Client project brief submissions with contact information and status tracking.
- `storage.buckets`: Public `portfolio` bucket for image uploads.
- **Row Level Security (RLS):** All tables enforce strict RLS policies allowing public reads for published content and authenticated access for administrative changes.

---

## 📩 Contact Brief & Edge Function Workflow

Client inquiries submitted on `/contact/` follow an abuse-protected submission pipeline:

1. **Client Submission:**
   - The browser generates a unique client UUID v4 (`submissionId`) for idempotent retries.
   - Enforces a hidden honeypot field (`website`) to detect automated spambots.
   - Validates character lengths and formats client-side according to `contracts/enquiry-contract.json`.
2. **Edge Function Processing (`supabase/functions/submit-enquiry`):**
   - Validates HTTP method (`POST`), Content-Type (`application/json`), and payload size (`<= 16 KB`).
   - Verifies request origins against allowed origins with CORS preflight support.
   - Normalizes text inputs, strips control characters, and performs strict whitelist validation.
   - Stores the brief in the `enquiries` table with status `new`.
   - Returns a structured 200 OK response with the `submissionId`.

---

## 🚀 Deployment to Cloudflare Pages

This site is optimized for zero-configuration deployment to Cloudflare Pages:

1. Connect your GitHub repository to Cloudflare Pages.
2. Configure the build settings:
   - **Framework preset:** `None`
   - **Build command:** *(leave empty)*
   - **Build output directory:** `site`
3. Environment variables (set in Cloudflare Pages dashboard if deploying Edge Functions):
   - Review `.env.example` for optional secret configurations.
4. Deploy! Your site will be live globally across Cloudflare's edge network.

---

## 📄 License & Attribution

&copy; 2026 Aayat Creative Studio. All rights reserved.  
Designed with aesthetic precision and engineered for performance.
