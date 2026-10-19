# IMPLEMENTATION_PLAN.md: Aayat Creative Studio Website

| | |
|---|---|
| **Product** | Aayat Creative Studio (@aayatcreativestudio) |
| **Based on** | PRD v0.1, DESIGN v0.2, ARCHITECTURE v0.2, DATABASE v0.1, API v0.1, AGENTS v0.1 |
| **Version** | 0.1 (Draft for approval) |
| **Scope** | MVP only (PRD 11.1). Nothing from PRD 11.2 or ARCHITECTURE 17.2 is planned. |

**Legend**

- `[ASSUMPTION]`: assumed where the documents are silent.
- `[DECISION NEEDED]`: the owner must decide before the task starts.
- Task IDs are `P<phase>.<number>`. Document references like `API 6.3` mean section 6.3 of API.md.
- Size: **S** (under a day), **M** (a few days), **L** (about a week or more). These are relative sizes, not commitments.

---

## 1. Planning Principles

1. **Foundations first.** Documents, then tooling, then design system and database, then reads, then the enquiry flow, then admin, then production readiness.
2. **Every task is one pull request, one concern**, small enough to review in one sitting and verify on its own (AGENTS 14.1). If a task grows past that, split it before starting.
3. **Every task includes its own tests and doc updates.** Nothing is "tested later".
4. **Every task follows AGENTS.md:** inspect existing code first, reuse patterns, no new dependencies, no secrets, no unrelated changes, and a final report (AGENTS 2.3, 2.8).
5. **Only documented features.** If a task seems to need something not in the documents, stop and ask (AGENTS 2.4).
6. **Work against the local stack by default.** Production is touched only in Phase 9 onward, and only when the owner directs it (AGENTS 14.3).

### 1.1 Definition of done (applies to every task)

Cited requirements met and nothing more. All relevant checks run and pass. States from DESIGN 12 exist where data is touched. Accessibility checks pass for UI. No secrets, personal data, debug output or dead code. Docs updated in the same change. Diff contains only task-related changes.

---

## 2. Phase Map

| Phase | Name | Size | Depends on |
|---|---|---|---|
| 0 | Document alignment (documents only) | M | None |
| 1 | Project foundation and tooling | M | 0 |
| 2 | Design system and shared UI | L | 1 |
| 3 | Database, security and shared contract | L | 1 |
| 4 | Public read path (pages that show content) | L | 2, 3 |
| 5 | Enquiry flow (function, email, retry, Contact page) | L | 2, 3 (4 for page patterns) |
| 6 | Admin foundation (sign-in, guard, reset) | M | 2, 3 |
| 7 | Admin content management | L | 4, 6 |
| 8 | Enquiry inbox | M | 5, 6 |
| 9 | Production readiness | M | 5, 7, 8 (parts can start earlier) |
| 10 | Hardening and quality assurance | M | 4 to 9 |
| 11 | Content entry and launch | S | 10 |

```
0 → 1 → ┬→ 2 ──┬→ 4 ──┬→ 7 ──┐
         └→ 3 ──┤      │      ├→ 9 → 10 → 11
                ├→ 5 ──┼→ 8 ──┘
                └→ 6 ──┘
```

Phases 2 and 3 can run in parallel. Phase 6 can run in parallel with Phases 4 and 5. Phase 9 tasks P9.1 and P9.2 have long lead times (accounts, domain, email DNS) and should start early.

---

## 3. Owner Inputs and Decision Gates

Work is blocked without these. Defaults come from the documents' decision tables and are used if the owner does not answer.

| Needed before | Input or decision | Source | Default if unanswered |
|---|---|---|---|
| Phase 0 | Approve amendments and defaults across documents | DATABASE 16, API 18, ARCHITECTURE 19 | Approve as written |
| Phase 1 | Supabase region (cannot be changed later) | AD-5 | Mumbai |
| Phase 1 | Static host | AD-6 | Cloudflare Pages |
| Phase 1 | Accounts: GitHub, Supabase, Cloudflare, Resend | n/a | None. Owner action. |
| Phase 2 | Logo files (transparent or vector, monogram, horizontal lockup, one-color, favicon) | DESIGN DD-1 | Supplied image on white surfaces, monogram plus text header |
| Phase 2 | Official brand colors and fonts | DESIGN DD-4 | Proposed tokens, Cormorant Garamond and Jost |
| Phase 3 | Budget range options and currency | AD-10, DB-1 | One option: `not_sure_yet` |
| Phase 3 | Database defaults | DB-1 to DB-8, AD-11 | As documented |
| Phase 4 | Hero images, services copy, About text and photo, "How it works" | DD-5, DD-6, DD-8 | Marked placeholders, steps block removed |
| Phase 5 | Owner notification email, domain for sending, response-time wording | PRD D5, D13, DD-7 | Dev uses the email provider's test mode. Real values needed by P9. |
| Phase 9 | Supabase Pro plan, spend cap | AD-4 | Pro for production |
| Phase 10 | Analytics tool, privacy page | AD-8, PRD D10 | Cookieless free-tier tool, short privacy note only |
| Phase 11 | Portfolio images (8 to 12 pieces), testimonials, settings content | PRD 13 assumption 6 | Launch is blocked on content, not code |

---

## 4. Phases

---

### Phase 0: Document alignment (documents only)

**Size:** M

**Goal:** Make the project documents consistent with each other and with the plain HTML, CSS and JavaScript constraint, so every later task has one unambiguous source of truth (AGENTS 2.5).

**Prerequisites:** Owner review of the amendment lists in DATABASE 16, API 18 and the decision tables.

#### Tasks

| ID | Task | Files or modules |
|---|---|---|
| P0.1 | Revise ARCHITECTURE.md for plain HTML, CSS and JavaScript: multi-page site, native ES modules, no build step, public config by hostname, plain `fetch` on public pages, vendored Supabase client on admin pages only, Edge Functions in JavaScript, JavaScript tests, folder structure identical to AGENTS 4, item URL `/work/item/?slug=`, caching strategy for unhashed assets, strict CSP with no inline code, performance budgets. Remove React, Vite and TypeScript content. | `docs/ARCHITECTURE.md` |
| P0.2 | Apply DATABASE amendments A1 to A8 (private schema, no composite indexes, singleton settings, JPEG fallback, retry window, PRD data model, alt fields) | ARCHITECTURE, PRD, DESIGN |
| P0.3 | Apply API amendments A1 to A9 (trigger error identifiers, function contract details, new variables, enquiry list pagination, 429 wording, service codes, Q3 note) | ARCHITECTURE, DATABASE, DESIGN, PRD |
| P0.4 | PRD amendments: item URL, `/admin/reset` route, Services and About as separate pages (D6), reorder buttons (FR-19), "Email not sent" badge (FR-21), budget codes, new data fields | `docs/PRD.md` |
| P0.5 | DESIGN amendments: self-hosted fonts, BEM classes instead of CSS Modules, components as CSS plus small JavaScript, focus rules for multi-page navigation, `?category=` filter URL, alt text for testimonial screenshot and About photo | `docs/DESIGN.md` |
| P0.6 | Record owner decisions in every decision table (replace defaults with approvals and dates). Create `docs/setup-notes.md` containing the "verify at setup" checklist from ARCHITECTURE, DATABASE and API. Add an owner-inputs tracker (section 3 of this plan). | all docs, `docs/setup-notes.md` |
| P0.7 | Cross-document consistency review. Update AGENTS 2.5 (remove the resolved conflict table) and re-check AGENTS 4 and 7. | all docs, `AGENTS.md` |

**Database or API changes:** none (documents only).

**Tests required (review checklists):**
- Search all documents for obsolete terms (React, Vite, TypeScript, Firebase, CSS Modules, `/work/:slug`). None remain except in marked history notes.
- Every requirement, decision and endpoint ID referenced anywhere exists in its source document.
- Folder structure in ARCHITECTURE and AGENTS 4 are identical. Environment variable list in API 14 matches ARCHITECTURE 11.2.

**Completion criteria:** documents consistent and owner-approved. No open conflicts. The owner-inputs tracker exists. Phase 1 can start with no ambiguity.

---

### Phase 1: Project foundation and tooling

**Size:** M

**Goal:** A repository where a trivial change passes automated checks and appears on a preview URL, with the safety checks already enforcing AGENTS rules.

**Prerequisites:** Phase 0 merged. AD-5 and AD-6 approved. Accounts created.

#### Tasks

| ID | Task | Files or modules | Tests and checks |
|---|---|---|---|
| P1.1 | Repository skeleton: folders per AGENTS 4, `.gitignore`, `README` stub, `.env.example` (names only, from API 14), docs in `docs/` | root, `docs/` | Folder check against AGENTS 4 |
| P1.2 | Dev tooling: `package.json` (dev only), lockfile, linter with forbidden-API rules (`innerHTML`, `eval`, `var`, inline handlers, unused or undefined variables as errors), formatter, named scripts (`lint`, `format-check`, `unit`, `integration`, `e2e`, `local-server`, `db-start`, `db-reset`) documented in README | `package.json`, config files, `README` | One sample unit test runs. Lint fails on a temporary file using `innerHTML` (then removed). |
| P1.3 | Safety scripts: secret scan over the repo and `site/`, contract sync check (stub until P3.1) | `scripts/` | Scan fails on a planted fake secret (temporary). Passes on clean tree. |
| P1.4 | Local Supabase stack: CLI init, `config.toml` (sign-ups disabled, Data API exposes `public` only, GraphQL off, Realtime unused), start and reset scripts. Verify and record platform facts in `setup-notes`. | `supabase/config.toml`, `scripts`, `docs/setup-notes.md` | Empty migration replays from scratch on the local stack |
| P1.5 | Hosted dev Supabase project in the approved region, linked to the repo (owner creates, agent documents) | `setup-notes`, `README` | Dev project reachable. No secrets committed. |
| P1.6 | Static hosting: Cloudflare Pages dev project, placeholder `index.html` and `404.html`, `_headers` with the strict CSP (no inline code), security headers and cache rules per ARCHITECTURE 13.3 and 15.3 | `site/`, `site/_headers` | Preview URL loads. Headers confirmed present. No CSP violations in the browser console. |
| P1.7 | CI workflow: lint, format check, unit tests, secret scan, forbidden-API lint on every pull request. Branch protection on `main` (owner action). Preview deploy on pull requests. | `.github/workflows/` | CI green on a trivial pull request. A deliberately failing check blocks merge. |
| P1.8 | Public config skeleton: `site/js/config.js` mapping hostnames to project URL, publishable key, site URL, analytics ID. Local values for the local stack. Unknown hostnames fail closed. | `site/js/config.js` | Unit test: unknown host yields an error, known hosts resolve |

**Database or API changes:** none (empty local database).

**Phase tests:** all tests above.

**Completion criteria:** a trivial change passes CI and shows on a preview URL with the correct security headers (ARCHITECTURE M0). Scripts named and documented. Secret scan and forbidden-API lint enforced in CI.

---

### Phase 2: Design system and shared UI

**Size:** L. Runs in parallel with Phase 3.

**Goal:** Every reusable visual and behavioral building block in DESIGN.md exists once, accessible, in all states, using tokens only.

**Prerequisites:** Phase 1. Font files with licenses. Logo image (supplied one is enough).

#### Tasks

| ID | Task | Files or modules | Tests and checks |
|---|---|---|---|
| P2.1 | Tokens: colors, status colors, type scale, spacing, radii, motion (DESIGN 4, 5, 6, 13) | `site/css/tokens.css` | Unit test computes contrast of every approved text and background pair and asserts AA |
| P2.2 | Self-hosted fonts (Latin subset, weights used only), swap loading, fallback stacks, preload of the critical files, license files | `site/assets/fonts/`, `site/css/base.css` | Page renders with fallback when fonts blocked. No external font requests. |
| P2.3 | Base and layout styles: reset, typography, links, focus ring, skip link, reduced motion, container, grid, section spacing, reading column, visually-hidden | `site/css/base.css`, `site/css/components/` | Manual check at 320 and 1440 pixel widths. Reduced-motion verified. |
| P2.4 | Icon sprite (about 14 icons) with license notice, usage convention | `site/assets/icons/` | All icons render. Meaningful ones have accessible names. |
| P2.5 | Component styles A (actions and forms): buttons (all variants and states incl. loading), links, field (label, input, textarea, select, helper, error, optional marker, counter), file upload area | `site/css/components/` | Visual states checked on the showcase page (P2.10) |
| P2.6 | Component styles B (feedback and display): banner, toast, badge, dialog, skeleton, empty and error states, gold rule, eyebrow, portfolio card, category filter, service block, testimonial, image placeholder | `site/css/components/` | Same |
| P2.7 | JavaScript foundations: DOM helper (never builds markup from strings), announcer (live regions), content module (all user-visible wording), enums module (category, service, status) | `site/js/lib/dom.js`, `announce.js`, `content.js`, `enums.js` | Unit tests for pure parts. DOM helper verified in browser tests (P2.10). Lint confirms no `innerHTML`. |
| P2.8 | UI behaviors: toast (auto-dismiss, pause on focus, close), dialog (focus trap, Esc, focus restore), skeleton, empty and error builders | `site/js/components/` | Browser tests: keyboard operation, focus restore, announcements |
| P2.9 | Header and footer custom elements: logo variants per DESIGN 2.2 and 2.3, mobile menu sheet, `aria-current`, primary CTA, social links, reserved height to avoid layout shift, no-script fallback | `site/js/components/site-header.js`, `site-footer.js`, `site/assets/brand/` | Browser tests at all breakpoints: menu keyboard operation, current-page state, skip link |
| P2.10 | Dev-only component showcase page rendering every component and state, excluded from deployment [DECISION NEEDED, default yes] | `site/dev/` (excluded from deploy) | Used by all tests in this phase |
| P2.11 | Raw-value check script: fails CI on hex colors, pixel sizes or durations outside `tokens.css` | `scripts/` | Fails on a planted raw value, passes on clean tree |

**Database or API changes:** none.

**Tests required:** contrast unit test, browser tests on the showcase (keyboard, focus visibility, reduced motion, announcements), automated accessibility scan, raw-value check, manual review at the six widths in DESIGN 14.

**Completion criteria:** all components in DESIGN 8 exist with all states, tokens only, accessibility scan clean, no raw values, header and footer work on the placeholder pages. Logo usage matches DESIGN 2.3.

---

### Phase 3: Database, security and shared contract

**Size:** L. Runs in parallel with Phase 2.

**Goal:** The complete schema, row-level security, Storage rules and shared enquiry contract exist, are tested against the local stack, and are the only way data is accessed.

**Prerequisites:** Phase 1. DB-1 to DB-8, AD-10 and AD-11 approved.

#### Tasks (each migration is its own task with its tests, in the order of DATABASE 13.2)

| ID | Task | Files or modules | Tests |
|---|---|---|---|
| P3.1 | Shared enquiry contract: rule module, enum constants, valid and invalid test vectors, sync script copying it into `site/js/api/` and `supabase/functions/_shared/`, CI drift check | `contracts/`, `scripts/` | Unit tests run all vectors. Drift check fails when a copy is edited. |
| P3.2 | Migration 1: private schema, extensions, revoke default privileges, disable GraphQL | `supabase/migrations/` | Replay from empty. Anonymous role cannot reach `private`. |
| P3.3 | Migration 2: enum types and the two `sort_order` sequences | migrations | Replay. Enum values match DATABASE 5. |
| P3.4 | Migration 3a: `site_settings`, `portfolio_items`, `portfolio_images` with constraints, unique keys and cascade | migrations | Constraint tests (lengths, formats, singleton, unique image order, variants shape) |
| P3.5 | Migration 3b: `testimonials`, `enquiries`, `private.admin_users`, `private.rate_limits` | migrations | Enquiry constraint tests using the shared vectors |
| P3.6 | Migration 4a: `is_admin()`, `check_rate_limit()`, `rls_audit()` | migrations | Rate limit allows five per hour, rejects the sixth, enforces daily ceiling, not callable by anonymous or authenticated roles |
| P3.7 | Migration 4b: triggers (updated time, slug generation, first publish, slug immutability, publish requires image and alt, keep last image) with the stable error identifiers from API 9.5, plus `move_portfolio_item` and `move_testimonial` | migrations | Slug collisions get suffixes. Slug cannot change after first publish. Cascade delete is not blocked. Swap and no-op at ends. |
| P3.8 | Migration 5: table privileges, enable RLS everywhere, policies, function permissions (DATABASE 10) | migrations | Anonymous, non-admin and admin matrix tests (DATABASE 15.2 tests 1 to 3, 6, 11) |
| P3.9 | Migration 6: `site-images` bucket (public, 3 MB, WebP and JPEG) and Storage policies (admin insert and delete only, no listing, no update) | migrations | Upload and delete rules, oversize and wrong type rejected, anonymous listing empty (test 13) |
| P3.10 | Migration 7: indexes (DATABASE 9.3 only) | migrations | Replay. Index list matches the document. |
| P3.11 | Migration 8: required reference data (the single settings row) | migrations | Row exists once and cannot be deleted by the admin |
| P3.12 | Local seed (`[SAMPLE]`-prefixed items, testimonials, enquiries) and a helper to upload placeholder images | `supabase/seed.sql`, `scripts/` | Seed loads. Every title starts with `[SAMPLE]`. |
| P3.13 | Wire `rls_audit` into CI as the `check-rls` gate. Integration test runner added to CI with the local stack. | `scripts/`, `.github/workflows/` | CI fails when a table without RLS is added (temporary test) |

**Database or API changes:** entire schema (DATABASE 6, 7, 10, 12, 13). Data API, RPC and Storage endpoints become available (PUB-1 to PUB-4, PUB-6, ADM-1 to ADM-22 data surfaces).

**Phase tests:** DATABASE 15.2 tests 1 to 7 and 9 to 13 (test 8 completes in Phase 5), migration replay and no-drift check.

**Completion criteria:** migrations replay from empty. `rls_audit` returns nothing. All database tests pass in CI. The contract and its vectors are the single source of enquiry rules.

---

### Phase 4: Public read path

**Size:** L

**Goal:** Visitors can browse the real site structure against the local stack, with every loading, empty and error state.

**Prerequisites:** Phases 2 and 3. Placeholder copy accepted for content the owner has not supplied.

#### Tasks

| ID | Task | Files or modules | Tests |
|---|---|---|---|
| P4.1 | Data-access foundation: `fetch` wrapper (public key header, 10 second timeout, one retry on network error or 5xx), error mapping to the categories in API 9.4, validators for slug, category and ids | `site/js/lib/`, `site/js/api/` | Unit tests with simulated responses and hostile values (filter injection strings) |
| P4.2 | Public data modules: settings with built-in defaults (PUB-1), published list with images and limit 200 (PUB-2), item by slug (PUB-3), testimonials (PUB-4). Explicit columns only. | `site/js/api/` data modules | Unit tests for shaping. Integration tests: only published rows, excluded columns absent. |
| P4.3 | Responsive image builder: sets from stored variants, width and height, eager or lazy, placeholder and error fallback | `site/js/lib/images.js` | Unit tests for variant selection. Browser test: no layout shift. |
| P4.4 | Metadata helper for dynamic pages, and base head tags (title, description, canonical, share tags, language, viewport) in every HTML page | `site/js/lib/seo.js`, page HTML | Test that each page has unique title and description |
| P4.5 | Portfolio grid and card using CSS columns for the masonry layout, skeleton, empty and error states | `site/js/components/`, `site/css/` | Browser tests for all states and column counts per breakpoint |
| P4.6 | Work page: category filter driven by `?category=` (validated), live-region result count, URL kept in sync | `site/work/`, `site/js/pages/work.js` | Browser test: filter, shareable URL, invalid value shows All, announcement |
| P4.7 | Item page: single item with stacked images, metadata, previous and next, back link keeping the filter, not-found state, dynamic title | `site/work/item.html`, `site/js/pages/work-item.js` | Browser tests including not found and keyboard order |
| P4.8 | Home page: hero, featured grid, services summary, testimonials section (hidden when empty or failed), closing CTA. Hero images from DD-5, placeholder until supplied. | `site/index.html`, `site/js/pages/home.js` | Browser tests for each section failing independently. Hero visible without scrolling at 375×667. |
| P4.9 | Services and About pages as static HTML with owner copy placeholders (clearly marked), About text and photo from settings with fallback | `site/about/` | Browser test, accessibility scan |
| P4.10 | 404 page, `robots.txt`, static `sitemap.xml` (static routes only) | `site/` | Unknown URL shows 404. Sitemap lists only public static pages. |

**Database or API changes:** none new. Uses PUB-1 to PUB-4 and PUB-6.

**Tests required:** unit, integration (reads), browser journey J2 with simulated Data API failures and empty data, an XSS test where a title containing markup displays as plain text, accessibility scans on Home, Work, Item, Services, About, a Lighthouse baseline recorded.

**Completion criteria:** all public pages work against the seeded local stack in every state in DESIGN 12.2. No data is rendered as HTML. Accessibility scans clean.

---

### Phase 5: Enquiry flow

**Size:** L

**Goal:** A visitor can send a project enquiry, it is stored once, the owner is notified, and no lead is lost if email fails.

**Prerequisites:** Phases 2 and 3 (Phase 4 patterns reused). AD-7 approved. Email provider account. A local email stub. Real notification address and sending domain needed by P5.9.

#### Tasks

| ID | Task | Files or modules | Tests |
|---|---|---|---|
| P5.1 | Function scaffolding and shared helpers: configuration reader that fails fast, request ID, error envelope, CORS allow-list, capped body reader, logger without personal data. Verify platform facts (public function setting, JavaScript entrypoint, trusted client IP header, injected variable names) and record in `setup-notes`. | `supabase/functions/_shared/`, `docs/setup-notes.md` | Tests for method, origin, content type, size cap (including a lying length), invalid JSON, headers (API 17.1 items 6, 7, 11) |
| P5.2 | `submit-enquiry` validation path: honeypot returns identical success and stores nothing, normalization, validation using the synced contract, `unknown_field`, field error map | `supabase/functions/submit-enquiry/` | API 17.1 items 3 to 5, 10 |
| P5.3 | Rate limit and insert: hashed caller key, hourly and daily counters counting valid requests only, fail closed on failure, idempotent insert by `submissionId`, success body | same | API 17.1 items 1, 2, 8, 9 and DATABASE test 8, 9 |
| P5.4 | Email module: plain-text builder, control-character stripping, subject cap, Reply-To from the validated email, timeout, idempotency key, test-only address override, local stub server | `supabase/functions/_shared/`, `tests/` | API 17.2 item 12 including header injection attempts |
| P5.5 | Background notification after the response: send, set `notified_at`, leave empty on failure | `submit-enquiry` | Stub success and failure cases |
| P5.6 | `retry-notifications`: secret check in constant time, batch of 20 oldest first within 7 days, sequential pauses, stop on authentication failure, skip transient failures, summary | `supabase/functions/retry-notifications/` | API 17.2 items 13 to 15 |
| P5.7 | Migration 9: scheduled jobs (retry every 10 minutes, daily rate-limit cleanup) reading URL and secret from the vault. Document the manual vault setup. | migrations, `README` | Job registered. Cleanup deletes only expired rows. Local call reaches the function. |
| P5.8 | Contact page and form module: field order, input types and autocomplete, validation timing, character counter, honeypot, `submissionId`, loading and double-submit prevention, confirmation panel with focus, failure banner keeping data and showing fallback contacts, rate-limit message, privacy note | `site/contact/`, `site/js/pages/contact.js`, content module | Unit tests on contract vectors in the browser copy. Browser journey J1 on mobile and desktop widths including retry with the same ID. Accessibility scan. |
| P5.9 | Dev environment check: deploy functions and secrets to the dev project, send a real test enquiry, confirm the email arrives within a minute, confirm the retry path by forcing a failure | `setup-notes` | Manual verified checklist recorded |

**Database or API changes:** PUB-5 and SYS-1 endpoints, Migration 9. No new tables.

**Tests required:** API 17.1 and 17.2 in full, DATABASE tests 8 and 9, contract drift check, browser journey J1.

**Completion criteria:** ARCHITECTURE gates 5 to 8 pass. A visitor can submit on the local stack and on dev. A failed email is retried and sent exactly once. No personal data appears in logs or responses.

---

### Phase 6: Admin foundation

**Size:** M. Can run in parallel with Phases 4 and 5.

**Goal:** Only the owner can sign in to a protected admin area, reset a password, and sign out, with authorization enforced by the database.

**Prerequisites:** Phases 2 and 3. Resend SMTP available on dev for reset emails.

#### Tasks

| ID | Task | Files or modules | Tests |
|---|---|---|---|
| P6.1 | Vendor the pinned Supabase client with its license and checksum through a documented script. Loaded on admin pages only. | `site/js/lib/supabase.js`, `scripts/` | Checksum check in CI. Public pages contain no reference to it. |
| P6.2 | Admin shell: page pattern with pending state, not-indexable markup and header, dense admin styles, top bar (monogram, nav, View site, Logout) | `site/admin/`, `site/css/admin.css`, `_headers` | Browser tests at all breakpoints. Admin routes send the no-index header. |
| P6.3 | Auth module and guard: sign-in, session refresh, logout, ADM-1 check on every admin page load, redirect when not admin, generic invalid-credentials and rate-limited messages, login page | `site/js/admin/` | Browser tests: success, failure, guard redirect, logout. Unit tests for error mapping. |
| P6.4 | Password reset: request page (always the same neutral message), set-new-password page (minimum length 12) | `site/admin/reset.html` | Browser test using the local mail catcher. Neutral message for unknown email. |
| P6.5 | Auth configuration on local and dev: sign-ups disabled, Email only, custom SMTP, redirect allow-list, rate limits, password policy. Write the admin creation runbook (Auth user plus `admin_users` row). Record verified settings. | `supabase/config.toml`, `README`, `setup-notes` | Integration: sign-up rejected, non-admin signed-in user gets `false` and no data, same result for wrong password and unknown email |

**Database or API changes:** none. Uses AUTH-1 to AUTH-5 and ADM-1.

**Tests required:** integration and browser tests above, accessibility scan on login and reset.

**Completion criteria:** ARCHITECTURE gates 2 and 10 (reset part) pass. The owner can sign in and out on local and dev. A signed-in non-admin has no access to anything.

---

### Phase 7: Admin content management

**Size:** L

**Goal:** The owner can create, edit, order, publish and delete portfolio items, testimonials and site settings without a developer (PRD J3).

**Prerequisites:** Phases 4 and 6.

#### Tasks

| ID | Task | Files or modules | Tests |
|---|---|---|---|
| P7.1 | Admin data modules (ADM-2 to ADM-16): allowed-field lists, `no-store` requests, mapping database rule identifiers to fixed messages | `site/js/api/` | Unit tests: forbidden fields never sent (`slug`, `sort_order`, `published` on create), identifier mapping |
| P7.2 | Portfolio list: status badges, publish toggle, move up and down buttons, delete with confirm dialog (files first, then rows), empty and loading states, stacked cards on mobile | `site/admin/portfolio/` | Browser tests including keyboard reorder and delete order |
| P7.3 | Image pipeline: validate type and size, decode, re-encode to strip metadata, compute variant widths [ASSUMPTION] (for example 480, 960, 1600, never above the original), WebP with detected JPEG fallback, unique file names and paths | `site/js/lib/images.js` | Unit tests for variant math and path naming. Browser test in Chromium and WebKit using test images. |
| P7.4 | Upload and delete (ADM-21, ADM-22): cache header, no overwrite, progress, partial failure reporting and retry, files-before-rows ordering | `site/js/api/admin.js` | Integration: allowed uploads succeed, others rejected. Browser test of a simulated failure midway. |
| P7.5 | Portfolio editor: create draft, edit, add and remove images with order, alt text rules, publish and unpublish with mapped errors, unsaved-changes dialog, sticky action bar on mobile, live preview, saved toast | `site/admin/portfolio/editor.html` | Browser tests for every rule in DATABASE 8.2 as seen by the user |
| P7.6 | Testimonials admin: list, editor, optional screenshot with required alt text, publish, move, delete | `site/admin/testimonials/` | Browser and integration tests |
| P7.7 | Settings admin: tagline, About text, About photo with alt text, Instagram handle, WhatsApp, contact email, with validation mirroring the database | `site/admin/settings.html` | Browser test: change appears on the public site |

**Database or API changes:** none new. Uses ADM-2 to ADM-16, ADM-21, ADM-22.

**Tests required:** DATABASE tests 3, 4, 10 re-run through the UI paths, browser journey J3 (sign in, upload, create, publish, see it on the public Work page, unpublish, reorder, delete), XSS test with markup in all admin text fields, accessibility scans on list, editor, testimonials, settings, a manual keyboard-only run.

**Completion criteria:** PRD J3 works end to end on the local stack and on dev. Every database rule produces a clear message. Orphan files never cause broken rows.

---

### Phase 8: Enquiry inbox

**Size:** M

**Goal:** The owner can read, triage and delete enquiries safely (PRD J4).

**Prerequisites:** Phases 5 and 6.

#### Tasks

| ID | Task | Files or modules | Tests |
|---|---|---|---|
| P8.1 | Enquiries data module (ADM-17 to ADM-20): explicit list columns, 25 per page up to 100, status filter validated, stable ordering, total from the response header | `site/js/api/` | Unit tests for page math and validation. Integration test for pagination and count. |
| P8.2 | Inbox list page: filter, rows (name, brand, service, date, status badge), pagination controls, loading, empty and error states | `site/admin/enquiries/` | Browser tests with many seeded rows |
| P8.3 | Detail page: all fields as plain text, reply link built from the validated email, `reference_link` clickable only if it starts with `http` or `https` and opens safely, status control (`status` only), delete with confirm | `site/admin/enquiries/detail.html` | Integration: status-only update, delete, no insert. Browser tests including unsafe link scheme and markup in text. |
| P8.4 | "Email not sent" indicator: unnotified enquiries older than a threshold [ASSUMPTION] 15 minutes, shown in list, detail and nav count | admin modules | Integration plus browser test using a forced email failure |

**Database or API changes:** none. Uses ADM-17 to ADM-20.

**Tests required:** browser journey J4 (submit enquiry, see it in the inbox, mark contacted, delete), accessibility scans.

**Completion criteria:** PRD J4 works. ARCHITECTURE gate 4 passes. The admin never sees a way to create or edit an enquiry's content.

---

### Phase 9: Production readiness

**Size:** M. P9.1 and P9.2 should start early because of lead times.

**Goal:** A production environment, a safe release process, backups and monitoring exist and have been rehearsed.

**Prerequisites:** AD-4 approved (Pro plan). Domain (D13), notification email (D5), Resend sending domain. Owner directs any production action (AGENTS 14.3).

#### Tasks

| ID | Task | Files or modules | Tests and checks |
|---|---|---|---|
| P9.1 | Production Supabase project (region fixed), Pro plan, spend cap on, migrations applied, vault values, function secrets, Auth settings, admin user and `admin_users` row, GraphQL off, exposed schema check | `README`, `setup-notes` | `rls_audit` clean. Anonymous and non-admin checks pass against production (read-only checks). |
| P9.2 | Domain and hosting: production Pages project, custom domain with SSL, email DNS records (SPF and DKIM) verified, `MAIL_FROM` set | hosting settings, DNS | HTTPS works. Sender verified in the email provider. |
| P9.3 | Release pipeline: approval-gated workflow running all checks, then migrations, then functions, then the site. Rehearse on dev first. Document rollback. | `.github/workflows/deploy-prod`, `README` | Dry run on dev succeeds. Rollback rehearsed. |
| P9.4 | Production entry in the public config for the real domain. Verify unknown hostnames fail closed. | `site/js/config.js` | Unit test |
| P9.5 | Backups and recovery: confirm daily backups, document the manual export before destructive migrations and before launch, restore drill into dev, record the time taken, note that Storage files are not in database backups | `README`, `setup-notes` | Restore drill completed and recorded |
| P9.6 | Monitoring: usage and spend alerts, optional uptime monitor, how to read function logs, verify the "Email not sent" indicator against a forced failure on dev | `README`, `setup-notes` | Forced failure is visible within one retry cycle |
| P9.7 | README complete: local run, scripts, environments, manual setup steps, deployment, rollback, restore, secret rotation (rehearse cron secret rotation on dev) | `README` | A second person can follow it from scratch |

**Database or API changes:** none new. Production receives the existing migrations.

**Tests required:** dry-run release, restore drill, rotation rehearsal, production smoke test (admin sign-in, one real test enquiry arrives by email, then deleted).

**Completion criteria:** all production-readiness items in ARCHITECTURE 15.6 that do not depend on content are checked. Rollback and restore have been rehearsed.

---

### Phase 10: Hardening and quality assurance

**Size:** M

**Goal:** Prove the MVP meets every non-functional requirement and every launch gate before any content goes live.

**Prerequisites:** Phases 4 to 9.

#### Tasks

| ID | Task | Tests and checks |
|---|---|---|
| P10.1 | Finalize and test the CSP and security headers on a preview of every public and admin page | No violations in the browser console. No inline script or style. Framing denied. |
| P10.2 | Analytics integration (AD-8): one wrapper, four events (`page_view`, `enquiry_form_started`, `enquiry_submitted`, `cta_start_project_clicked` with placement), no personal data, silent on failure | Unit tests. Browser test inspects outgoing payloads for personal data. |
| P10.3 | Performance pass: JavaScript budget [ASSUMPTION] about 40 KB compressed on public pages, module preload hints for the page graph, image loading audit, font preload, cache headers (revalidate pages, styles and scripts, immutable fonts and images) | Lighthouse gate: mobile performance at least 85, LCP at most 2.5 seconds on 4G (PRD NFR) |
| P10.4 | Accessibility full pass: scans on every page, keyboard-only run, screen reader pass (VoiceOver on iOS and one desktop reader), 200% zoom, contrast of all token pairs, reduced motion | Findings fixed. Results recorded. |
| P10.5 | SEO and sharing: per-page metadata check, share image and simplified favicon (needs logo assets, DD-1), sitemap and robots verified, admin not indexable | Metadata test per page |
| P10.6 | Privacy: privacy note near the form, decision on a policy page (D10), confirm logs and analytics contain no personal data (API 15) | Log inspection on dev with a test enquiry |
| P10.7 | Security review: secret scan of the repository and `site/`, `rls_audit`, the anonymous and non-admin suites on dev, rate limit and honeypot exercised, XSS tests, dependency audit, forbidden-API lint, CORS allow-list review | All of API 17.3 item 21 and ARCHITECTURE gate 9 pass |
| P10.8 | Cross-browser and device pass: latest two versions of Chrome, Safari including iOS, Edge and Firefox. Real-phone enquiry and image upload test including the JPEG fallback. | Recorded results |
| P10.9 | Placeholder and content readiness check: zero `[SAMPLE]` rows in production, About text no longer the default, no placeholder images, no TODOs without IDs | Checklist and a query on production |

**Database or API changes:** none unless a defect is found. Any fix follows AGENTS (new migration, documents first).

**Completion criteria:** every gate in ARCHITECTURE 14.2, DATABASE 15.2 and API 17 passes. Lighthouse and accessibility targets met. No open critical defects.

---

### Phase 11: Content entry and launch

**Size:** S

**Goal:** The site goes live with real content and is verified in production.

**Prerequisites:** Phase 10 complete. Portfolio images (8 to 12 pieces), testimonials, About text and settings supplied by the owner.

#### Tasks

| ID | Task |
|---|---|
| P11.1 | Owner enters real portfolio items, testimonials and settings through the admin area. Copy review for tone and accuracy (DESIGN 9.3, no invented claims). |
| P11.2 | Final production smoke test: public pages, filter, item pages, a real test enquiry with email received, admin sign-in, then delete the test enquiry |
| P11.3 | Complete the launch checklist in ARCHITECTURE 15.6 and PRD Definition of Done (section 14) |
| P11.4 | Update the Instagram bio link and announce |
| P11.5 | First-week monitoring: logs, "Email not sent" indicator, usage, error reports from visitors. Log findings as backlog items. Do not build items from the Future list without a new PRD entry. |
| P11.6 | After 60 days, review the success criteria in PRD 2.2 using the analytics events and enquiry count, and review the Future triggers in ARCHITECTURE 17.2 |

**Completion criteria:** PRD Definition of Done is met. The owner has added and published an item without help.

---

## 5. Requirement Coverage

| PRD requirement | Delivered in |
|---|---|
| FR-1 Home | P4.8 |
| FR-2, FR-3, FR-4 Portfolio, filter, item detail | P4.5, P4.6, P4.7 |
| FR-5, FR-6 Services, About | P4.9, P7.7 |
| FR-7 Testimonials | P4.8, P7.6 |
| FR-8, FR-13 to FR-17 Enquiry | P3.1, P5.1 to P5.9 |
| FR-9 Contact links | P2.9, P4.8, P7.7 |
| FR-10 Navigation and footer | P2.9 |
| FR-11 SEO | P4.4, P4.10, P10.5 |
| FR-12 404 page | P4.10 |
| FR-18 Admin login and reset | P6.3, P6.4 |
| FR-19 Portfolio management | P7.2 to P7.5 |
| FR-20 Testimonial management | P7.6 |
| FR-21 Enquiry inbox | P8.1 to P8.4 |
| FR-22 Settings | P7.7 |
| FR-23 Confirm destructive actions | P2.8, P7.2, P7.6, P8.3 |
| NFR performance, accessibility, security, privacy, reliability | P2, P3, P5, P9, P10 |

---

## 6. Risks and Mitigations

| Risk | Mitigation in the plan |
|---|---|
| Platform behavior changed since the documents were written | Every "verify at setup" item is a recorded step (P1.4, P5.1, P6.5, P9.1, P9.5) |
| Browser cannot encode WebP (notably Safari) | JPEG fallback built into P7.3 and tested in WebKit and on a real phone (P10.8) |
| Many small module files slow page loads without a bundler | Shallow module graphs, preload hints and a Lighthouse gate (P10.3) |
| A strict CSP found to break something late | Strict CSP enforced from P1.6, every task runs under it |
| Email domain verification takes days | P9.2 starts early. Dev uses test mode until then. |
| Owner content not ready at launch | Content tracked in section 3. Launch is blocked on content, not code. |
| Free-tier project pausing or no backups | Production uses the Pro plan (AD-4). Never launch on Free. |
| Secrets leaked or misplaced | Secret scan from P1.3, names-only `.env.example`, rotation rehearsal in P9.7 |
| Schema and function rules drift apart | Single shared contract with sync and drift check (P3.1) |
| Scope creep | AGENTS stop-and-ask triggers, requirement IDs on every task, no Future items without a new PRD entry |

---

## 7. Recommended First Task

**P0.1: Revise ARCHITECTURE.md for plain HTML, CSS and JavaScript** (documents only, one pull request).

**Why this first:**
- It is the only open conflict between the documents and the owner's stack constraint (AGENTS 2.5). Every later task relies on the structure, configuration, caching, testing and folder decisions it fixes.
- It writes no application code, so it carries no risk and can be reviewed quickly.
- It unlocks the rest of Phase 0 and then Phase 1.

**Scope of the task:** replace the React, Vite and TypeScript parts of ARCHITECTURE.md with the multi-page plain HTML, CSS and JavaScript design (sections 2.1, 3, 5, 8, 11, 14 and 15 are the most affected), keep the Supabase design unchanged, use the folder structure in AGENTS 4, and apply the amendments listed against ARCHITECTURE.md in DATABASE 16 and API 18 that fall inside those sections.

**Done when:** no obsolete terms remain in ARCHITECTURE.md, its folder structure matches AGENTS 4, its decision table lists the approved defaults, and the owner has approved it.

---

**Start in parallel now (owner actions with long lead times):**

1. Create the GitHub, Supabase, Cloudflare and Resend accounts, and choose the Supabase region (AD-5, cannot be changed later).
2. Decide the domain and the notification email (PRD D13 and D5), so email verification can begin early.
3. Collect the logo files in the formats listed in DESIGN 2.2, and the official brand colors and fonts if they exist.
4. Start gathering 8 to 12 portfolio pieces, testimonials, About text and Services copy.
