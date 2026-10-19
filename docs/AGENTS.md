# AGENTS.md: Coding Rules for Aayat Creative Studio

> These rules govern every change made to this codebase. They are mandatory, not advisory.
> Source of truth: **PRD.md**, **DESIGN.md**, **ARCHITECTURE.md**, **DATABASE.md**, **API.md**.

---

## 0. Before You Write a Single Line

1. **Read first.** Before touching any file, read the relevant section of the source documents and read the existing code in the area you are changing. Never assume — verify.
2. **Understand the why.** Every table, endpoint and component exists for a named PRD requirement. If you cannot trace your change to one, stop and ask.
3. **Reuse before you create.** Search the codebase for an existing function, module or pattern that already does what you need. Copy the pattern, do not reinvent it.
4. **One concern per change.** A pull request / commit does exactly one thing. Refactoring and feature work are never mixed. Unrelated fixes are separate commits.
5. **If something is unclear, ask.** Do not guess and ship. Surface the ambiguity.

---

## 1. Project Structure

```
aayatcreativestudio/
├── docs/                   # Source-of-truth documents (never auto-generated)
│   ├── PRD.md
│   ├── DESIGN.md
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── API.md
│   └── AGENTS.md
├── site/                   # Public-facing website (plain HTML, CSS, JS)
│   ├── index.html          # Home page
│   ├── work/
│   │   ├── index.html      # Work / portfolio list
│   │   └── item.html       # Portfolio item detail
│   ├── about/
│   │   └── index.html
│   ├── contact/
│   │   └── index.html
│   ├── admin/              # Admin pages (require is_admin())
│   │   ├── index.html      # Sign-in
│   │   ├── dashboard.html
│   │   ├── portfolio/
│   │   ├── testimonials/
│   │   ├── enquiries/
│   │   ├── settings.html
│   │   └── reset.html
│   ├── css/
│   │   ├── tokens.css      # Design tokens (colors, type, spacing)
│   │   ├── base.css        # Reset and global styles
│   │   ├── components/     # One file per component
│   │   └── pages/          # Page-specific overrides
│   ├── js/
│   │   ├── config.js       # Public config (URL, key) — NOT secrets
│   │   ├── api/            # One module per surface (data, auth, storage)
│   │   ├── components/     # Reusable UI modules
│   │   ├── pages/          # One file per page
│   │   └── lib/            # Vendored third-party scripts
│   └── assets/             # Optimised images for the site chrome
├── supabase/
│   ├── migrations/         # Numbered SQL files, forward-only
│   ├── seed.sql            # Local dev only — NEVER run on prod
│   ├── functions/
│   │   ├── submit-enquiry/
│   │   │   └── index.js
│   │   └── retry-notifications/
│   │       └── index.js
│   └── tests/              # JS tests against the local stack
├── scripts/                # Helper scripts (local dev only)
├── .env.example            # Variable NAMES only, no values
├── .gitignore
└── README.md
```

**Rules:**
- Never create a folder that does not appear above without updating this file first.
- Never place application code outside `site/` or `supabase/`.
- Never place secret values anywhere in the repository.

---

## 2. Technology Constraints

| Layer | Technology | Forbidden |
|---|---|---|
| Public pages | Plain HTML, CSS, native ES modules (`type="module"`) | React, Vue, Svelte, TypeScript, Vite, Webpack, Parcel, any bundler |
| Admin pages | Same, plus the vendored Supabase client (`lib/supabase.js`) | Any other framework or build tool |
| Edge Functions | JavaScript (Deno runtime via Supabase) | TypeScript compilation, external npm packages not whitelisted below |
| Database | Standard PostgreSQL, Supabase extensions (pg_cron, pg_net, Vault) | ORMs, query builders, stored procedures outside the migrations directory |
| CSS | Vanilla CSS with design tokens | Tailwind, Bootstrap, any utility framework |
| Email | Resend REST API via `fetch` | Nodemailer, SendGrid, any SDK |

**Allowed Edge Function dependencies:** the Supabase JS client (for the privileged key call), and nothing else. Every dependency must be justified in the commit message and approved before use.

**No build step on public pages.** The browser loads files directly. There is no compilation, no transpilation, no code generation in the `site/` directory.

---

## 3. Code Quality and Naming

### 3.1 General

- **Write for the next reader, not the linter.** Clear names beat clever tricks every time.
- **Functions do one thing.** If you cannot describe a function in one sentence without "and", split it.
- **No dead code.** Remove commented-out blocks before committing. Use version control for history.
- **No magic numbers or strings.** Named constants only. Put them at the top of the file or in a shared `constants.js`.
- **Maximum line length:** 100 characters. Break earlier for readability.
- **Indentation:** 2 spaces. Never tabs.

### 3.2 Naming conventions

| Context | Convention | Example |
|---|---|---|
| JavaScript variables and functions | `camelCase` | `fetchPortfolioItems`, `submissionId` |
| JavaScript constants | `SCREAMING_SNAKE_CASE` | `MAX_BODY_BYTES`, `DEFAULT_TIMEOUT_MS` |
| JavaScript modules / filenames | `kebab-case` | `submit-enquiry.js`, `portfolio-api.js` |
| CSS classes | `kebab-case` | `.card-title`, `.btn-primary` |
| CSS custom properties (tokens) | `--kebab-case` with a `--cs-` prefix | `--cs-color-surface`, `--cs-spacing-md` |
| SQL identifiers | `snake_case`, plural tables | `portfolio_items`, `sort_order` |
| HTML `id` attributes | `kebab-case`, unique per page | `enquiry-form`, `submit-btn` |
| HTML `data-*` attributes | `kebab-case` | `data-item-id`, `data-category` |

### 3.3 JavaScript style

```js
// GOOD — explicit, one responsibility, named export
export async function fetchPublishedItems() {
  const { data, error } = await supabase
    .from('portfolio_items')
    .select('id, slug, title, ...')
    .eq('published', true)
    .order('sort_order', { ascending: false })
    .limit(200);
  if (error) throw mapDataApiError(error);
  return data;
}

// BAD — implicit, mixed concerns, no error handling
const items = await supabase.from('portfolio_items').select('*');
```

- Use `const` by default. Use `let` only when reassignment is required. Never use `var`.
- Use `async`/`await`. Never mix `.then()` chains with `await` in the same function.
- Destructure function parameters when there are more than two.
- Export named functions and objects. Default exports are only for ES module entry points.

---

## 4. HTML and CSS

### 4.1 HTML

- One `<h1>` per page (DESIGN and SEO requirement).
- Use semantic elements: `<nav>`, `<main>`, `<article>`, `<section>`, `<header>`, `<footer>`, `<figure>`, `<time>`.
- Every `<img>` must have a meaningful `alt` attribute. Decorative images use `alt=""`.
- Every interactive element must have a unique `id` for testing.
- Form inputs must have associated `<label>` elements (either wrapping or `for`/`id`).
- Do not inline styles. No `style` attributes on elements. All styling is in CSS files.
- Do not inline scripts. All JavaScript is in `<script type="module" src="...">` tags.

### 4.2 CSS

- Define all colors, spacing, type and shadow values as CSS custom properties in `tokens.css`. Never hard-code a hex color or pixel value in a component file.
- Component CSS files live in `css/components/`. One file per component, named to match the component.
- Page-specific overrides go in `css/pages/`. They must not redefine a token — only use them.
- Mobile-first media queries. Use `min-width` breakpoints, not `max-width`.
- No `!important`. If you need it, the cascade is wrong — fix the cascade.

```css
/* GOOD */
.card {
  background: var(--cs-color-surface);
  padding: var(--cs-spacing-md);
  border-radius: var(--cs-radius-md);
}

/* BAD */
.card {
  background: #1a1a2e;
  padding: 16px;
  border-radius: 8px;
}
```

---

## 5. Component Reuse

- Before writing a new component, check `js/components/` and `css/components/` for an existing one.
- A component that appears on more than one page lives in `components/`, not in a `pages/` file.
- Components receive data as plain JS objects or DOM `data-*` attributes. They do not fetch data themselves — the page module fetches and passes data in.
- Components emit standard DOM `CustomEvent`s for user interactions. Pages listen and respond.
- Never duplicate markup across pages. Extract a shared HTML `<template>` element or a JS render function.

---

## 6. API and Database Access

### 6.1 The data-access layer is the only caller

- All Supabase calls live in `js/api/`. Page and component code never imports `supabase` directly.
- One module per surface: `js/api/data.js` (PostgREST), `js/api/auth.js` (Auth), `js/api/storage.js` (Storage).
- The modules return plain JS objects or throw typed errors (section 6.3). They never return raw Supabase responses.

### 6.2 Select explicitly

- Every query names its columns. Never use `.select('*')`.
- Public reads select only the columns listed in API.md section 5.
- The admin enquiry list (ADM-17) selects only `id, name, brand_name, service, status, notified_at, created_at` — not email, phone or free text.

### 6.3 Error mapping

- Every API module wraps errors using the category map in API.md section 9.4. Raw Supabase error objects never leave the `js/api/` layer.
- Callers handle these categories: `network`, `permission`, `not_found`, `conflict`, `validation`, `invalid_credentials`, `rate_limited`, `upload_rejected`, `unknown`.

```js
// js/api/errors.js — the only place that imports raw Supabase errors
export function mapDataApiError(error) {
  if (!navigator.onLine || error.message?.includes('Failed to fetch')) {
    return { category: 'network', raw: error };
  }
  if (error.code === 'PGRST116') return { category: 'not_found', raw: error };
  if (error.code === '42501' || error.status === 403) return { category: 'permission', raw: error };
  // … and so on for every category
  return { category: 'unknown', raw: error };
}
```

### 6.4 Filter safety

- All filter values (slug, UUID, category, status) are validated against their expected format before being placed in a query.
- Free text is **never** placed into a PostgREST filter expression.
- Slugs and enum values are validated against known-good patterns before use (API.md 10.4).

### 6.5 Admin guard on every admin page load

- Every admin page calls `ADM-1` (`rpc/is_admin`) at the top of its page module, before rendering any content.
- If the result is not `true`, call `AUTH-3` (sign out) and redirect to the sign-in page.
- The check happens on every page load, not once per session.

---

## 7. Edge Functions

### 7.1 Structure

Each function lives in its own directory under `supabase/functions/`. It exports a single `serve` handler. Internal logic is split into small, named helper functions within the same file. There are no shared modules across functions in MVP (each function is self-contained and independently deployable).

### 7.2 Processing order is fixed

`submit-enquiry` always follows the 10-step order in API.md section 6.3. Steps are not reordered, skipped or merged. Each step is a named function call. Comments name each step.

```js
// submit-enquiry/index.js
serve(async (req) => {
  const methodCheck = checkMethod(req);           // Step 1
  if (methodCheck) return methodCheck;

  const originCheck = checkOrigin(req);           // Step 2
  if (originCheck) return originCheck;

  const contentTypeCheck = checkContentType(req); // Step 3
  if (contentTypeCheck) return contentTypeCheck;

  // … and so on
});
```

### 7.3 Secrets are read at startup

Read every required environment variable at the top of the handler module. If any required variable is missing or empty, return a generic `503` immediately. Never fall back to a default value for a secret.

```js
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const IP_HASH_SALT   = Deno.env.get('IP_HASH_SALT');
const CRON_SECRET    = Deno.env.get('CRON_SECRET');

if (!RESEND_API_KEY || !IP_HASH_SALT || !CRON_SECRET) {
  console.error('Missing required environment variable at startup');
  // serve() wrapper handles returning 503
}
```

### 7.4 Every outbound call has a timeout

Use `AbortController` and `signal` for every `fetch`. Timeouts are from the constant table in API.md section 16.2.

### 7.5 Logging rules

Log: `{ requestId, endpoint, outcome, durationMs, enquiryId? }`.

Never log: names, email addresses, phone numbers, project details, any enquiry field, IP addresses, API keys, tokens, or stack traces in production.

---

## 8. Security and Secrets

### 8.1 Absolute prohibitions

- **Never commit a secret.** No API keys, no salts, no database passwords, no tokens — in any file, in any commit, in any branch.
- **Never place the Supabase secret key in any browser-reachable file.** The publishable key is the only Supabase credential allowed in `site/`.
- **Never log personal data.** See section 7.5.
- **Never echo submitted values in error responses.** Error bodies contain codes, not values.
- **Never store the raw IP address.** Only the HMAC hash (in `private.rate_limits`).
- **Never skip the origin check** in `submit-enquiry`.
- **Never skip the `is_admin()` check** on any admin data operation.
- **Never use `SELECT *`** on a table that contains personal data.

### 8.2 Content security

- All enquiry text is rendered as plain text (`textContent`, never `innerHTML`).
- `referenceLink` is only made into a clickable `<a>` after confirming it starts with `http://` or `https://`. Use `rel="noopener noreferrer"` and `target="_blank"`.
- Do not construct SQL, PostgREST filter strings or email headers from free-text input. Use parameterised queries and strip control characters first.

### 8.3 CI secret-key check

The CI pipeline runs a check that fails if a Supabase secret-key pattern (`service_role` or the project's actual key value) appears anywhere in the `site/` directory. This check must not be bypassed or deleted.

### 8.4 Dependency security

- No npm package may be added to a function without explicit approval.
- Vendored browser scripts (for example the Supabase client) are pinned to an exact version and committed. They are never loaded from a CDN at runtime.
- Review the changelog of any vendored script before updating it.

---

## 9. Error Handling

### 9.1 Fail loudly in development, gracefully in production

- In development (local stack), unhandled errors throw and surface in the console.
- In production, every error is caught, mapped to a category, and shown to the user as a designed state (DESIGN 12). Raw errors are never surfaced.

### 9.2 Every async call is wrapped

```js
// GOOD
async function loadWork() {
  try {
    const items = await fetchPublishedItems();
    renderItems(items);
  } catch (err) {
    showErrorState('work-list', err.category);
  }
}

// BAD — unhandled rejection
fetchPublishedItems().then(renderItems);
```

### 9.3 Designed error states, not alert boxes

- `alert()`, `confirm()` and `prompt()` are never used in the public or admin UI.
- Errors are shown inline (field errors), in a banner, or as a full section-replacement state, per DESIGN 12.2.
- Every error state includes what the user can do next (retry, use a fallback contact, go back).

### 9.4 Admin write errors preserve input

- When an admin form write fails, the entered values are kept in the form. The user is never asked to retype their work.
- The submit button is re-enabled after a failure so the user can retry.

---

## 10. Testing

### 10.1 What is tested

| Test type | Location | What it covers |
|---|---|---|
| Database tests | `supabase/tests/db/` | All 13 gates in DATABASE.md 15.2 |
| API acceptance tests | `supabase/tests/api/` | All tests in API.md 17 |
| Contract test vectors | `supabase/tests/contract/` | Shared valid/invalid field cases used by both function and browser |

### 10.2 Rules

- Tests run against the **local Supabase stack only**. They never touch the dev or production project.
- The email provider is replaced by the local stub via `MAIL_API_URL` in all tests.
- Seed data uses invented names and emails starting with `[SAMPLE]`. Real data is never used in tests.
- A test that requires a secret reads it from the local `.env`. It never hardcodes a value.
- Every new constraint, trigger, policy or endpoint must have a test before the migration or function is merged.
- The `rls_audit()` test (DATABASE 15.2, item 11) must always pass. It is a CI gate — it cannot be skipped.

### 10.3 Test naming

```
describe('submit-enquiry', () => {
  it('returns 200 and one row for a valid first submission')
  it('returns 200 and still one row for a repeated submissionId')
  it('returns 400 with validation_failed for a missing required field')
  // ...
});
```

Test names read as a sentence: `it('<subject> <verb> <outcome> <condition>')`.

### 10.4 CI gates (must all pass before merge)

1. `rls_audit()` returns no tables.
2. All database tests pass.
3. All API acceptance tests pass.
4. No schema drift reported.
5. No secret-key pattern found in `site/`.
6. No `[SAMPLE]` rows in the production project (checked post-deploy).

---

## 11. Documentation

### 11.1 Source documents are authoritative

- `PRD.md`, `DESIGN.md`, `ARCHITECTURE.md`, `DATABASE.md`, `API.md` and `AGENTS.md` are the source of truth. Code follows documents, not the other way around.
- If code and a document disagree, **the document is right until the document is updated**.
- Do not edit source documents to match broken code. Fix the code or open a change to the document with explicit approval.

### 11.2 Code comments

- **Why, not what.** Comments explain decisions, trade-offs and non-obvious constraints. They do not restate what the code does.
- Reference document sections by ID where relevant.

```js
// Rate limit is checked AFTER validation (API.md 6.3 step 8).
// Invalid submissions do not consume the allowance.
const withinLimit = await checkRateLimit(callerKey, RATE_LIMIT_PER_HOUR, 'hour');
```

- JSDoc comments on every exported function: `@param`, `@returns`, one-line description.
- SQL migration files have a header comment: migration number, date, what it does, which document section it implements.

```sql
-- Migration 003: tables
-- 2026-10-19
-- Creates all application tables (DATABASE.md section 6).
-- Run after 002-types-and-sequences.sql.
```

### 11.3 README

- The README contains: project overview, environment setup steps, local dev commands, the manual per-environment setup steps (DATABASE.md 13.5), and the account recovery path for the admin.
- It does not contain secret values, real email addresses or personal data of any kind.

### 11.4 Updating documents

- Any change that affects the API contract, database schema, environment variables or security model requires a corresponding update to the relevant source document in the **same commit**.
- New decisions added to source documents include the date and the decision-maker.

---

## 12. Git and Change Discipline

### 12.1 Commit scope

- One logical change per commit. A commit either: adds a feature, fixes a bug, refactors (no behavior change), updates a document, or updates a test. Never two of these at once.
- Commits that change the schema include the migration file and its test in the same commit.
- Commits that change an API endpoint include the updated API.md section and its test.

### 12.2 Commit message format

```
<type>(<scope>): <short imperative summary>

<body — why this change, what it does, which requirement it satisfies>

Refs: PRD FR-13, API.md 6.3
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `security`.

Examples:
```
feat(enquiry): add submit-enquiry edge function

Implements PUB-5 (API.md 6). Validates the shared contract fields,
checks the rate limit, inserts the enquiry, and triggers the owner email.

Refs: PRD FR-13 to FR-17, API.md 6, DATABASE.md 6.5
```

```
security(rls): add enquiries_admin_read policy

Ensures only is_admin() users can read enquiry rows.
Closes the gap identified in the rls_audit() test.

Refs: DATABASE.md 10.3
```

### 12.3 What never goes in a commit

- Secret values of any kind.
- Commented-out code.
- `console.log` statements left from debugging (use a named `debug()` helper that is a no-op in production).
- Changes unrelated to the commit's stated purpose.
- `seed.sql` changes applied to the dev or production project.
- Files generated by a build tool (there should be none — no build step).

### 12.4 Migration discipline

- Migrations are forward-only. Once pushed to any hosted environment, a migration file is never edited.
- Each migration is idempotent where possible (use `IF NOT EXISTS`, `CREATE OR REPLACE`).
- Before a destructive migration (DROP, RENAME, type change): take a manual backup, test on the dev project, then apply to production.
- The migration number prefix is a zero-padded three-digit integer: `001`, `002`, …, `009`, `010`.

---

## 13. Deployment and Environments

### 13.1 Three environments

| Environment | Stack | Data | Secret sharing |
|---|---|---|---|
| Local | `supabase start` + `seed.sql` | Invented `[SAMPLE]` data only | Own `.env`, never committed |
| Dev (hosted) | Supabase project (dev) | Invented data, no real enquiries | Own secrets in Supabase dashboard |
| Production | Supabase project (prod) + Cloudflare Pages | Real data | Own secrets, never shared with dev |

Dev and production **never share secrets**. A secret rotation in one environment does not affect the other.

### 13.2 Deploy order

Per ARCHITECTURE.md and API.md 2.7:

1. Apply database migrations (`supabase db push`).
2. Deploy Edge Functions.
3. Deploy the site.

Never reverse this order. The new site must never call a schema or endpoint that does not yet exist.

### 13.3 Launch checks (must pass before going live)

- `rls_audit()` returns no tables on the production project.
- No `[SAMPLE]` rows in any content table.
- The About text is not the seeded default.
- The admin sign-in, portfolio list, enquiry form, and owner notification email all work end-to-end.
- The CI secret-key check passes on the built site files.

---

## 14. Things That Are Explicitly Forbidden

The following are never acceptable, regardless of urgency or convenience:

| Forbidden action | Reason |
|---|---|
| Editing a migration that has been applied to any hosted environment | Breaks reproducibility and schema drift checks |
| Storing a secret in any file in the repository | Security breach |
| Placing the Supabase service role key in browser code | Bypasses all row-level security |
| Using `innerHTML` to render user-supplied content | XSS |
| Using `SELECT *` on a table with personal data | Over-fetches, leaks data in logs |
| Skipping the `is_admin()` check on an admin operation | Authorization bypass |
| Connecting to the production database from a local script | Risk of real data loss or leak |
| Running `seed.sql` on a hosted environment | Pollutes real data with sample data |
| Using `alert()` or `confirm()` in the UI | Poor UX, breaks accessibility |
| Adding a runtime CDN dependency | Availability and integrity risk |
| Logging personal data | Privacy violation |
| Soft-deleting content (using `deleted_at`) | DATABASE.md 3.4 explicitly excludes this |
| Adding a table to the Supabase Realtime publication | DATABASE.md technology decision |
| Enabling the GraphQL extension | DATABASE.md technology decision |

---

## 15. Quick Reference: Key IDs

When writing code or comments, use these IDs to cross-reference requirements:

| ID format | Where | Example |
|---|---|---|
| `FR-n` | PRD.md functional requirements | `FR-13` (enquiry form) |
| `D-n` | PRD.md decisions | `D3` (WhatsApp optional) |
| `AD-n` | ARCHITECTURE.md architectural decisions | `AD-4` (Pro plan) |
| `DB-n` | DATABASE.md decisions | `DB-6` (hard delete) |
| `AP-n` | API.md decisions | `AP-2` (reject unknown fields) |
| `J1`–`J4` | PRD.md user journeys | `J1` (Instagram visitor to enquiry) |
| `PUB-n`, `AUTH-n`, `ADM-n`, `SYS-n`, `EXT-n` | API.md endpoint IDs | `PUB-5` (submit-enquiry) |
| `Q-n` | DATABASE.md query IDs | `Q2` (portfolio list) |
| `DD-n` | DESIGN.md design decisions | `DD-3` (masonry grid) |
