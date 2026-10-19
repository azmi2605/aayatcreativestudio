# DATABASE.md: Aayat Creative Studio Website

| | |
|---|---|
| **Product** | Aayat Creative Studio (@aayatcreativestudio) |
| **Depends on** | PRD.md v0.1, ARCHITECTURE.md v0.2 (Supabase), DESIGN.md v0.2 |
| **Version** | 0.1 (Draft for approval) |
| **Audience** | Owner and coding agent. This file defines the complete data model. |

**Legend**

- `[ASSUMPTION]`: assumed because it was not specified. Correct it if wrong.
- `[DECISION NEEDED DB-n]`: the owner must approve before it is built. Defaults are in section 16.
- Requirement IDs (FR-n), decisions (AD-n, D-n) and journeys (J1 to J4) refer to the other documents.

**Notes on the source documents**

The project must be built in plain HTML, CSS and JavaScript. That constraint does not change the data model. It does mean the browser talks to the database through the Supabase Data API with plain `fetch` (public pages) and the Supabase client (admin pages only).

ARCHITECTURE.md has not yet been revised for the plain HTML, CSS and JavaScript constraint. This document follows the Supabase design in ARCHITECTURE.md v0.2 and lists where it must change in section 15.

SQL is the only language that can define a Postgres schema. SQL files are treated as configuration, not application code (see ARCHITECTURE AD on languages).

---

## 1. Purpose and Principles

### 1.1 What the database stores

Five kinds of data, and nothing else:

1. **Public content** the owner publishes: portfolio items and their images, testimonials, site settings.
2. **Enquiries** submitted by visitors (personal data).
3. **Admin identity**: which Auth user is the admin.
4. **Rate-limit counters** that protect the enquiry form.
5. **File references**: paths pointing to images in Supabase Storage (the files themselves are not in the database).

### 1.2 Principles

| Principle | Description |
|---|---|
| **Only required data** | Every table and column traces to a PRD requirement. Anything else is listed in 3.4 as deliberately not modeled. |
| **One source of truth per fact** | No duplicated values. Derived values (public image URLs, cover image, counts) are computed, not stored. |
| **The database is the last line of defense** | Client and function validation exist, but constraints, triggers and RLS must keep the data valid and private even if both fail. |
| **Default deny** | Nothing is readable or writable unless a rule says so. |
| **Boring and small** | Standard Postgres features only. Few tables, few indexes, no premature optimization. |

---

## 2. Database Technology

| Item | Decision |
|---|---|
| **Engine** | PostgreSQL, managed by Supabase (current stable major version offered at project creation, verify at setup) |
| **Access paths** | Data API (PostgREST) for browsers, under RLS. Edge Functions with the privileged key for the enquiry flow. SQL migrations for schema changes. |
| **Schemas** | `public` (exposed to the Data API) and `private` (not exposed, holds internal tables). `auth` and `storage` are platform-managed. |
| **Extensions** | `pg_cron` (scheduled jobs), `pg_net` (cron calls the retry function), Supabase Vault (secrets used by cron). No other extensions. The unused GraphQL extension is disabled to reduce attack surface. |
| **Region** | One region, chosen at project creation and fixed afterwards (AD-5, default Mumbai) |
| **Plan** | Free while building. Pro for production (AD-4), for backups and no inactivity pausing |
| **Time** | All timestamps are `timestamptz` (stored in UTC, displayed in the viewer's locale) |
| **Identifiers** | UUIDs (random). They avoid enumerable public IDs and require no coordination. |
| **Realtime** | Not used. No table is added to the realtime publication. |

---

## 3. Data Model Overview

### 3.1 Entities

| Entity | Table | Purpose | PRD source |
|---|---|---|---|
| Portfolio item | `public.portfolio_items` | A piece of work shown on the site | FR-2 to FR-4, FR-19 |
| Portfolio image | `public.portfolio_images` | Images belonging to an item | FR-4, FR-19, DESIGN DD-3 |
| Testimonial | `public.testimonials` | Client feedback | FR-7, FR-20 |
| Site settings | `public.site_settings` | About text, tagline, contact links (one row) | FR-6, FR-9, FR-22 |
| Enquiry | `public.enquiries` | Project brief from a visitor | FR-8, FR-13 to FR-17, FR-21 |
| Admin user | `private.admin_users` | Identifies the admin among Auth users | FR-18, PRD section 3 |
| Rate limit | `private.rate_limits` | Counters for spam protection | FR-15 |

### 3.2 ER Diagram

```
PORTFOLIO_ITEMS (1) ──────── (0..20) PORTFOLIO_IMAGES
    │
    └── has slug (UK), category (enum), featured, published, sort_order

AUTH_USERS (1) ──── (0..1) ADMIN_USERS

TESTIMONIALS     ── standalone, sort_order
SITE_SETTINGS    ── singleton (boolean PK = true)
ENQUIRIES        ── standalone, status enum
RATE_LIMITS      ── standalone, composite PK (bucket_key, window_start)
```

`site_settings`, `testimonials`, `enquiries` and `rate_limits` are standalone by design. Enquiries are not linked to portfolio items or accounts, because visitors have no accounts and the PRD does not tie an enquiry to a work.

### 3.3 Relationships

| Relationship | Type | Rule |
|---|---|---|
| Portfolio item to images | One to many (0 to 20) | Images belong to exactly one item. Deleting an item deletes its image rows (cascade). Storage files are deleted separately (section 12). |
| Auth user to admin user | One to zero-or-one | Removing an Auth user removes the admin row (cascade). |

There are no other foreign keys. Storage files are referenced by path text, not by a foreign key into the `storage` schema, to avoid coupling to a platform-managed schema.

### 3.4 Deliberately not modeled

| Not modeled | Why |
|---|---|
| Services table | Services are static content in the site code (FR-5). |
| Categories table | Three fixed categories as an enum. If the owner later wants editable categories, move to a table then. |
| Clients or brands table | The brand is a text field on the item. No client management exists in scope. |
| Users, profiles, roles, permissions | One admin. `admin_users` is enough. |
| Image variants table | Variants are always read with their image and never queried alone, so they are stored as a validated list inside the image row. |
| Notifications table | One timestamp (`notified_at`) on the enquiry is enough. |
| Admin notes, tags, assignees on enquiries | Out of PRD scope. Replies happen outside the system. |
| Audit log, `created_by`, `updated_by` | Single admin, not required. Add `created_by` if a second admin is ever introduced. |
| Soft deletes (`deleted_at`) | Deletes are confirmed in the UI and backups exist (DB-6). Soft deletes would add complexity to every query and RLS policy. |
| Analytics events | Handled by the analytics provider. No personal data stored here. |
| Sessions, tokens | Owned by Supabase Auth. |

---

## 4. Conventions

| Topic | Rule |
|---|---|
| **Naming** | `snake_case`. Plural table names, except the singleton `site_settings`. Booleans read positively (`published`, `featured`). Timestamps end in `_at`. |
| **Primary keys** | `id` (UUID) except where noted (`site_settings`, `admin_users`, `rate_limits`). |
| **Required vs optional** | Columns are `NOT NULL` unless the PRD makes them optional. |
| **Text normalization** | Trim leading and trailing whitespace before storing (done by the function and the admin form). Constraints check lengths after trimming. |
| **Single-line text** | No control characters at all (including line breaks). |
| **Multi-line text** | Control characters rejected except tab and newline. |
| **Constraint names** | `<table>_<column>_<rule>` (for example `enquiries_email_format`), so errors map cleanly to user messages. |
| **Policy names** | `<table>_<who>_<action>` (for example `portfolio_items_public_read`). |
| **Ordering** | `sort_order` integer, higher shows first. |
| **File references** | Bucket-relative paths, never full URLs. The public URL is built from the project URL plus the path. |

---

## 5. Types

| Type | Values | Notes |
|---|---|---|
| `portfolio_category` | `ads`, `posters`, `social_media` | Matches PRD FR-3 labels Ads, Posters, Social Media |
| `enquiry_service` | `ad_creatives`, `poster_design`, `social_media_design`, `other` | Matches the form options in PRD FR-13 |
| `enquiry_status` | `new`, `contacted`, `closed` | Default `new`. The admin may move between any of them. |

Adding a value later is a migration (add value), which is acceptable for such rarely changing lists.

---

## 6. Table Definitions

### 6.1 `public.portfolio_items`

| Column | Type | Null | Default | Constraints and notes |
|---|---|---|---|---|
| `id` | `uuid` | no | random UUID | PK |
| `slug` | `text` | no | generated on insert (7.2) | Unique. Format: lowercase letters, digits, single hyphens, 1 to 80 characters. Immutable once `first_published_at` is set. |
| `title` | `text` | no | none | 1 to 120 characters (trimmed), single-line |
| `client_brand` | `text` | no | none | 1 to 100 characters, single-line. The brand the work was made for. |
| `category` | `portfolio_category` | no | none | Enum |
| `description` | `text` | yes | null | Up to 500 characters, multi-line allowed |
| `alt_text` | `text` | yes | null | Up to 300 characters. Must be non-empty (trimmed) whenever `published` is true. |
| `featured` | `boolean` | no | false | Shown in Home "featured work" (FR-1) |
| `published` | `boolean` | no | false | Visible to the public when true. Publish rules in 8.2. |
| `first_published_at` | `timestamptz` | yes | null | Set once, by trigger, the first time `published` becomes true. Never cleared. Drives slug immutability. |
| `sort_order` | `integer` | no | next value of a dedicated sequence | Higher shows first. New items get a higher value than every earlier item, so the newest appears first by default (FR-2). |
| `created_at` | `timestamptz` | no | now | |
| `updated_at` | `timestamptz` | no | now | Maintained by trigger |

### 6.2 `public.portfolio_images`

| Column | Type | Null | Default | Constraints and notes |
|---|---|---|---|---|
| `id` | `uuid` | no | random UUID | PK |
| `item_id` | `uuid` | no | none | FK to `portfolio_items(id)`, ON DELETE CASCADE |
| `image_order` | `smallint` | no | none | 0 to 19. Unique together with `item_id`. The lowest value is the cover image. |
| `width` | `integer` | no | none | Intrinsic width of the original image in pixels, greater than 0 |
| `height` | `integer` | no | none | Intrinsic height in pixels, greater than 0. Width and height give the aspect ratio for the masonry grid and zero layout shift (DESIGN DD-3). |
| `variants` | `jsonb` | no | none | Non-empty list (1 to 6 entries) of objects, each with an integer width `w` greater than 0 and a text `path` (bucket-relative path of that file). Shape is enforced by a constraint. |
| `created_at` | `timestamptz` | no | now | |

**Notes:**
- Alt text is not stored per image. It lives on the item (PRD data model), which keeps one description per work.
- Variants hold paths. Variant file type (WebP or JPEG fallback) is implied by the file extension in the path.

### 6.3 `public.testimonials`

| Column | Type | Null | Default | Constraints and notes |
|---|---|---|---|---|
| `id` | `uuid` | no | random UUID | PK |
| `author_name` | `text` | no | none | 1 to 100 characters, single-line |
| `brand_name` | `text` | yes | null | Up to 100 characters, single-line (DB-2) |
| `quote` | `text` | no | none | 1 to 600 characters ([ASSUMPTION]), multi-line allowed |
| `image_path` | `text` | yes | null | Optional screenshot path in Storage |
| `image_alt` | `text` | yes | null | Up to 300 characters. Required (non-empty) when `image_path` is set (accessibility). |
| `published` | `boolean` | no | false | |
| `sort_order` | `integer` | no | next value of its own sequence | Higher shows first |
| `created_at` | `timestamptz` | no | now | |
| `updated_at` | `timestamptz` | no | now | Trigger |

### 6.4 `public.site_settings` (single row)

| Column | Type | Null | Default | Constraints and notes |
|---|---|---|---|---|
| `id` | `boolean` | no | true | PK. A check forces the value to be `true`, so at most one row can exist. |
| `tagline` | `text` | no | seeded | 1 to 120 characters, single-line |
| `about_text` | `text` | no | seeded | 1 to 3000 characters, multi-line allowed |
| `about_photo_path` | `text` | yes | null | Optional About photo path |
| `about_photo_alt` | `text` | yes | null | Required (non-empty) when `about_photo_path` is set |
| `instagram_handle` | `text` | no | seeded | Without `@`. 1 to 30 characters from letters, digits, dot, underscore. |
| `whatsapp_number` | `text` | yes | null | Digits only, 8 to 15 characters, international format without `+` ([ASSUMPTION]). Null means WhatsApp is not shown (PRD D3). |
| `contact_email` | `text` | yes | null | Public contact email, valid format, up to 254 characters |
| `updated_at` | `timestamptz` | no | now | Trigger |

This row is required reference data created by a migration (section 13.3). The application never inserts or deletes it, only updates it.

### 6.5 `public.enquiries`

| Column | Contract field | Type | Null | Default | Constraints and notes |
|---|---|---|---|---|---|
| `id` | `submissionId` | `uuid` | no | none (supplied by the function) | PK. The client-generated ID makes retries idempotent. |
| `name` | `name` | `text` | no | none | 1 to 100 characters, single-line |
| `brand_name` | `brandName` | `text` | no | none | 1 to 100 characters, single-line |
| `email` | `email` | `text` | no | none | Up to 254 characters. Basic format (one `@`, no whitespace, a dot in the domain). No control characters (blocks header injection). Stored lowercase (normalized by the function). |
| `phone` | `phone` | `text` | yes | null | Digits with common separators (`+` `(` `)` `-` `.` space), 5 to 30 characters |
| `service` | `service` | `enquiry_service` | no | none | Enum |
| `project_details` | `projectDetails` | `text` | no | none | 20 to 1000 characters (trimmed), multi-line allowed |
| `budget_range` | `budgetRange` | `text` | yes | null | Up to 60 characters. Allowed values live in the contract, not the database (DB-1). |
| `reference_link` | `referenceLink` | `text` | yes | null | Up to 500 characters, must start with `http://` or `https://`, no whitespace |
| `timeline` | `timeline` | `text` | yes | null | Up to 100 characters, single-line |
| `status` | none (admin sets) | `enquiry_status` | no | `new` | Only column the admin may change |
| `notified_at` | none | `timestamptz` | yes | null | Set when the owner email is sent successfully. Null means not yet notified. |
| `created_at` | none | `timestamptz` | no | now | |

The honeypot field is never stored. Enquiries have no `updated_at`: after creation only `status` changes, which does not need history.

### 6.6 `private.admin_users`

| Column | Type | Null | Default | Constraints and notes |
|---|---|---|---|---|
| `user_id` | `uuid` | no | none | PK, FK to `auth.users(id)`, ON DELETE CASCADE |
| `created_at` | `timestamptz` | no | now | |

Not exposed through the Data API. Read only inside `is_admin()` (section 7). Exactly one row is expected in MVP, but no rule enforces it so a second admin needs no schema change.

### 6.7 `private.rate_limits`

| Column | Type | Null | Default | Constraints and notes |
|---|---|---|---|---|
| `bucket_key` | `text` | no | none | PK part. Either `ip:` plus a salted hash of the caller's IP, or the literal `global` for the daily ceiling. Up to 80 characters. |
| `window_start` | `timestamptz` | no | none | PK part. Start of the hour (per-caller) or day (global) window. |
| `hit_count` | `integer` | no | 1 | Greater than 0 |
| `expires_at` | `timestamptz` | no | none | When the row may be deleted |

Not exposed through the Data API. Accessed only through the `check_rate_limit` function. Raw IP addresses are never stored.

---

## 7. Database Functions and Triggers

*Behavior only. Implementation is in migrations.*

### 7.1 Functions

| Function | Schema | Caller | Behavior |
|---|---|---|---|
| `is_admin()` | `public` | Authenticated users (called by policies and by the admin app) | Returns `true` only if the current Auth user has a row in `private.admin_users`. Runs with elevated privilege and a fixed search path, returns nothing else. Anonymous callers get no execute permission. |
| `check_rate_limit(bucket, limit, window)` | `public` | Service role only (the enquiry function) | Atomically increments the counter for the bucket and window, sets `expires_at`, and returns whether the caller is still within the limit. Used twice per submission: per caller per hour, and global per day. |
| `move_portfolio_item(item_id, direction)` | `public` | Authenticated (RLS makes it admin-only) | Swaps `sort_order` with the neighboring item in the given direction (`up` or `down`) in one statement. Does nothing at the ends of the list. |
| `move_testimonial(testimonial_id, direction)` | `public` | Authenticated (RLS makes it admin-only) | Same, for testimonials. |
| `rls_audit()` | `public` | Service role only (CI) | Returns the names of any tables in `public` or `private` where RLS is not enabled. Must return nothing. |

Every function has execute permission granted explicitly to the roles in the table. Default execute permission for other roles is revoked.

### 7.2 Triggers

| Trigger | On | Behavior |
|---|---|---|
| `set_updated_at` | `portfolio_items`, `testimonials`, `site_settings` (before update) | Sets `updated_at` to `now` |
| Slug generation | `portfolio_items` (before insert) | Builds the slug from the title: lowercase, non-alphanumerics become hyphens, repeated hyphens collapsed, trimmed, cut to 60 characters. If empty it uses `work`. If the slug exists, appends `-2`, `-3` and so on until unique. A client-supplied slug is ignored. |
| First publish | `portfolio_items` (before insert or update) | When `published` becomes `true` and `first_published_at` is null, sets `first_published_at` to `now` |
| Slug immutability | `portfolio_items` (before update) | If `first_published_at` is not null, rejects any change to `slug` |
| Publish requires image | `portfolio_items` (before insert or update) | When `published` is `true`, requires at least one image row for the item (an item cannot be created published, because it has no images yet) |
| Keep an image on published items | `portfolio_images` (before delete or update of `item_id`) | Rejects removing the last image of a published item. Skipped when the parent item is itself being deleted (cascade). |

---

## 8. Constraints and Validation

### 8.1 Layers

| Layer | Role |
|---|---|
| **Browser** | Fast feedback only (DESIGN 11.2). Never trusted. |
| **Edge Function (enquiries)** | Validates against the shared contract, normalizes (trim, lowercase email), then inserts. The server authority for enquiries. |
| **Database** | Enforces everything below, regardless of caller. A violation returns an error that the application maps to a plain message. |

Contract field rules and database constraints must match. Both are tested against the same test vectors (ARCHITECTURE section 14).

### 8.2 Business rules enforced by the database

| Rule | Enforced by |
|---|---|
| Only one settings row can exist | Check on `site_settings.id` plus no insert permission |
| An item cannot be published without alt text | Row check on `portfolio_items` |
| An item cannot be published without at least one image | Trigger (7.2) |
| A published item cannot lose its last image | Trigger (7.2) |
| Slugs are unique, URL-safe and never change after first publish | Unique constraint, format check, triggers |
| Image order is unique per item | Unique constraint on item and `image_order` |
| An image variant list is a non-empty list of `{w, path}` objects | Check on `variants` |
| Testimonial screenshots and About photo need alt text | Row checks |
| Enquiry email has no control characters or whitespace | Check on `email` |
| Enquiry reference link is an `http` or `https` URL | Check on `reference_link` |
| An enquiry cannot be created twice with the same ID | Primary key (the function treats a repeat as success) |
| Only the `status` of an enquiry can change | Column-level update permission (10.2) |
| Visitors never write to any table | No insert, update or delete permission for the anonymous role |

### 8.3 Rules deliberately not in the database

| Rule | Where it lives | Reason |
|---|---|---|
| Allowed budget ranges | Contract (DB-1) | Not defined yet (AD-10). A database list would force a migration on every change. |
| Image file type, size and dimensions | Storage bucket limits and the admin image pipeline | Files are not database rows |
| Rate limits (5 per hour per caller, 100 per day) | Function configuration | Tunable without a migration |
| Honeypot check | Function | Not data |

---

## 9. Query Catalog and Indexes

### 9.1 Real queries

*Every query the product runs, who runs it, and the access path.*

| ID | Query | Journey, requirement | Role | Tables |
|---|---|---|---|---|
| Q1 | Read the settings row | FR-6, FR-9, all pages | Visitor | `site_settings` |
| Q2 | List published items with their images, `sort_order` descending. Filter by category and "featured" is done in the browser. | J1, J2, FR-1 to FR-3 | Visitor | `portfolio_items`, `portfolio_images` |
| Q3 | Get one published item with images by slug (previous and next come from Q2) | FR-4 | Visitor | `portfolio_items` (slug), `portfolio_images` |
| Q4 | List published testimonials, `sort_order` descending | FR-7 | Visitor | `testimonials` |
| Q5 | Insert an enquiry (repeat ID is ignored) | J1, FR-13 to FR-17 | Function (service role) | `enquiries` |
| Q6 | Increment and check rate-limit counters | FR-15 | Function | `private.rate_limits` via `check_rate_limit` |
| Q7 | Find enquiries not yet notified, created within the last 7 days, oldest first, limited batch | Retry job | Function | `enquiries` |
| Q8 | Mark an enquiry as notified | FR-17 | Function | `enquiries` |
| Q9 | Admin lists all items or all testimonials, `sort_order` descending | J3, FR-19, FR-20 | Admin | `portfolio_items`, `testimonials` |
| Q10 | Admin reads, creates, updates, deletes an item, its images and testimonials. Publish validation runs in triggers. | J3 | Admin | content tables |
| Q11 | Admin lists enquiries newest first, optionally by status. Reads one. Updates status. Deletes one. | J4, FR-21 | Admin | `enquiries` |
| Q12 | Admin moves an item or testimonial up or down | FR-19 (AD-9) | Admin | via `move_*` functions |
| Q13 | Is the current user the admin? | FR-18 | Admin app, policies | `private.admin_users` via `is_admin()` |
| Q14 | Admin updates settings | FR-22 | Admin | `site_settings` |
| Q15 | Delete expired rate-limit rows (daily job) | Housekeeping | pg_cron | `private.rate_limits` |
| Q16 | Run the notification retry (every 10 minutes) | NFR reliability | pg_cron | calls the function, which runs Q7 and Q8 |

### 9.2 Expected data volume

| Table | Realistic size | Worst case |
|---|---|---|
| `portfolio_items` | 10 to 100 | About 100 (ARCHITECTURE assumption) |
| `portfolio_images` | 20 to 500 | 2,000 (100 items x 20) |
| `testimonials` | 3 to 30 | About 50 |
| `site_settings` | 1 | 1 |
| `enquiries` | Tens to a few hundred per year | About 36,000 per year if abuse reaches the global ceiling of 100 per day |
| `rate_limits` | Tens | Thousands during an attack, deleted daily |

### 9.3 Index decisions

*Rule: index only for integrity, or where a query runs on a table that can realistically exceed roughly 10,000 rows. Tables of a hundred rows are scanned faster than indexed.*

**Indexes created:**

| Index | Table and columns | Why |
|---|---|---|
| Primary keys | Each table | Required |
| Unique slug | `portfolio_items(slug)` | Integrity, and Q3 lookup by slug |
| Unique item and image order | `portfolio_images(item_id, image_order)` | Integrity. Its leading column `item_id` also serves the Q2 join and the cascade delete, so no separate foreign key index is created. |
| Newest first | `enquiries(created_at desc)` | Q11 list, Q7 range (last 7 days), and the only table that can grow into the tens of thousands |
| Expiry | `private.rate_limits(expires_at)` | Q15 cleanup stays cheap during a flood |

**Deliberately not indexed:**

| Query | Reason | Revisit when |
|---|---|---|
| Q2, Q4, Q9 (sort by `sort_order`, filter by `published`) | Tables hold about 100 rows or fewer. A sort of that size is negligible. | More than about 1,000 rows (not expected) |
| Enquiries filtered by status | The status filter is applied on the already ordered list. Result sets are small. | Enquiries exceed about 10,000 rows |
| Retry query on `notified_at is null` | Covered by the `created_at` index range (last 7 days) | Enquiries exceed about 10,000 rows |

---

## 10. Ownership and Authorization

### 10.1 Ownership model

This is a single-tenant product. All content belongs to the studio. There is no per-row owner column and no per-user data. Authorization is a role check, not a row-ownership check:

- **Visitor**: anonymous (`anon` role). Can read published content only.
- **Admin**: an authenticated user who passes `is_admin()`.
- **Service role**: used only inside Edge Functions and CI. Bypasses RLS. Never in browser code.

Being authenticated is not enough for any admin right. Every admin policy calls `is_admin()`.

### 10.2 Table privileges (what each role can even attempt)

*Privileges are the first gate. RLS is the second.*

| Table | anon | authenticated | Service role |
|---|---|---|---|
| `portfolio_items` | SELECT | SELECT, INSERT, UPDATE, DELETE | All |
| `portfolio_images` | SELECT | SELECT, INSERT, UPDATE, DELETE | All |
| `testimonials` | SELECT | SELECT, INSERT, UPDATE, DELETE | All |
| `site_settings` | SELECT | SELECT, UPDATE (no insert, no delete) | All |
| `enquiries` | None | SELECT, DELETE, and UPDATE on the `status` column only | All |
| `private.*` tables | None, and the schema is not exposed | None | Via functions only |

### 10.3 Row-level security policies

*RLS is enabled on every table in `public` and `private`. No policy means no access.*

| Table | Policy | Applies to | Operation | Rule |
|---|---|---|---|---|
| `portfolio_items` | `portfolio_items_public_read` | anon, authenticated | SELECT | `published is true` |
| `portfolio_items` | `portfolio_items_admin_all` | authenticated | All | `is_admin()` (using and check) |
| `portfolio_images` | `portfolio_images_public_read` | anon, authenticated | SELECT | The parent item is published |
| `portfolio_images` | `portfolio_images_admin_all` | authenticated | All | `is_admin()` |
| `testimonials` | `testimonials_public_read` | anon, authenticated | SELECT | `published is true` |
| `testimonials` | `testimonials_admin_all` | authenticated | All | `is_admin()` |
| `site_settings` | `site_settings_public_read` | anon, authenticated | SELECT | Always |
| `site_settings` | `site_settings_admin_update` | authenticated | UPDATE | `is_admin()` |
| `enquiries` | `enquiries_admin_read` | authenticated | SELECT | `is_admin()` |
| `enquiries` | `enquiries_admin_update_status` | authenticated | UPDATE | `is_admin()` (column grant limits it to `status`) |
| `enquiries` | `enquiries_admin_delete` | authenticated | DELETE | `is_admin()` |
| `enquiries` | (none for insert) | n/a | INSERT | No policy. Only the service role inserts. |
| `private.*` | (none) | n/a | All | No policies. Unreachable by API roles. |

**Policy implementation notes:**

- Admin policies evaluate `is_admin()` once per statement (not once per row), to keep them cheap.
- Because admin policies read a table each time, removing the admin row revokes access immediately, without waiting for a token to expire.
- Public queries must filter on `published`. A query without that filter returns only the published rows anyway, never an error leak.

### 10.4 Function permissions

| Function | anon | authenticated | Service role |
|---|---|---|---|
| `is_admin()` | no | yes | yes |
| `check_rate_limit()` | no | no | yes |
| `move_portfolio_item()`, `move_testimonial()` | no | yes (RLS then restricts to admin) | yes |
| `rls_audit()` | no | no | yes |

### 10.5 Exposure hardening

- Only the `public` schema is exposed through the Data API. `private` is not.
- The GraphQL endpoint is disabled (extension not used).
- No table is added to the realtime publication.
- Direct table privileges for `anon` and `authenticated` are limited to section 10.2. Default privileges for new tables are revoked, so a table added later is private until its migration grants access.
- The Data API's maximum rows per request stays at its default (1,000), far above any table here.

### 10.6 Storage authorization (files referenced by the database)

| Item | Rule |
|---|---|
| **Bucket** | `site-images`, public (files are readable through their CDN URL) |
| **Listing** | No read policy on the `objects` table, so anonymous users cannot list or enumerate files. They can only fetch a file whose path they know. |
| **Upload and delete** | Policies allow only `is_admin()` |
| **Overwrite** | No update policy. Files are never overwritten. Replacing an image means uploading a new file with a new name and deleting the old one. |
| **Limits** | 3 MB per file. Allowed types WebP and JPEG ([ASSUMPTION], DB-3). |

---

## 11. Sensitive Data Handling

### 11.1 Classification

| Data | Class | Where | Notes |
|---|---|---|---|
| Enquiry name, email, phone | Personal data | `enquiries` | Highest sensitivity in this system |
| Enquiry `brand_name`, `project_details`, `budget_range`, `reference_link`, `timeline` | Business-confidential, may contain personal data | `enquiries` | Free text. Treat as personal. |
| Caller IP | Personal data, never stored raw | Only as a salted hash inside `rate_limits.bucket_key` | Expires within about a day |
| Admin email and password | Credentials | Supabase `auth` schema | Managed by the platform. Password is hashed by Supabase, never visible to this project. |
| Admin identity row | Internal | `private.admin_users` | Not exposed |
| Portfolio, testimonials, settings | Public | Content tables | Published by the owner on purpose. Testimonial names are the owner's responsibility to publish with consent. |
| `contact_email`, `whatsapp_number` | Public by design | `site_settings` | Intentionally visible on the site |
| Secrets (email API key, IP hash salt, cron secret, secret key) | Secrets | Function secrets and Supabase Vault, never in tables or migrations | See ARCHITECTURE section 11 |

### 11.2 Handling rules

- **Access**: enquiries are readable only by the admin (10.3). No public, anonymous or service-key access from the browser.
- **Minimization**: the enquiry stores only the form's fields. No IP address, user agent, referrer or tracking identifiers. The honeypot value is never stored.
- **Transport and storage**: all connections use TLS. The platform encrypts data at rest.
- **Logging**: application logs (function logs) carry the enquiry ID and outcome only, never names, emails, phones or free text. Analytics events contain no personal data (ARCHITECTURE section 9).
- **Email copies**: each enquiry is also emailed to the owner (a second copy) and passes through the email provider. This is a necessary copy, and is part of the privacy note shown near the form.
- **Cleaning input**: control characters are rejected so values cannot be used for header injection or log forgery.
- **Rendering**: the application must display enquiry text as plain text only, and only turn `reference_link` into a clickable link after confirming it is `http` or `https`. The database check backs this up.
- **Retention and deletion**: enquiries are kept until the admin deletes them (PRD D7, DB-5). Deleting is a hard delete. Copies in the owner's mailbox, the email provider's logs and database backups age out separately (section 14). When someone asks for their data to be erased, the owner deletes the enquiry in the admin area and deals with the owner's mailbox copy. *This document is not legal advice. Review the data-protection obligations that apply to the studio's visitors before launch.*
- **Environments**: development and test databases contain only invented sample data, never real enquiries. Real data is never copied out of production.
- **No secrets in migrations or seed files**. Secrets are set per environment by hand (13.5).

---

## 12. Files and Storage Mapping

The database stores paths. Files live in the `site-images` bucket.

| Database reference | Path convention |
|---|---|
| `portfolio_images.variants[].path` | `portfolio/{item_id}/{image_id}-{width}.{webp or jpg}` |
| `testimonials.image_path` | `testimonials/{testimonial_id}/{unique_id}.{webp or jpg}` |
| `site_settings.about_photo_path` | `site/about-{unique_id}.{webp or jpg}` |

**Rules:**

- Paths contain unguessable UUIDs. Unpublished items' files are public by URL but not listable, so "unpublished" means not shown, not secret.
- A database row and its files are not linked by a foreign key, so deletion is ordered by the application: delete the files first, then the rows. A failure between the two leaves harmless orphan files. A scheduled cleanup is Future (ARCHITECTURE section 17).
- Replacing an image always writes new files with new names.

---

## 13. Migration and Seed Strategy

### 13.1 Principles

- Every schema change is a migration file in the repository (Supabase CLI, timestamped, applied in order). Nothing is changed by hand in the hosted database, except the one-time admin setup in 13.5.
- Migrations are forward-only. Once applied to production, a migration file is never edited. Fixes ship as new migrations.
- One concern per migration. Names describe the change.
- Local development rebuilds the whole database from migrations plus seed in one command. CI does the same on every pull request, and fails if the result differs from what the migrations describe (schema drift check).

### 13.2 Initial migration set (in order)

| # | Contents |
|---|---|
| 1 | Schemas (`private`), extensions, revoke default privileges |
| 2 | Enum types and sequences (the two `sort_order` sequences) |
| 3 | Tables with columns, defaults, primary keys, foreign keys, check and unique constraints |
| 4 | Functions and triggers (section 7) |
| 5 | Table privileges (10.2), enable RLS, policies (10.3), function permissions (10.4) |
| 6 | Storage bucket with limits, and Storage policies (10.6) |
| 7 | Indexes (9.3) |
| 8 | Required reference data: the `site_settings` row (13.3) |
| 9 | Cron jobs (retry every 10 minutes, daily cleanup), reading their settings from Vault (13.5) |

### 13.3 Required reference data (a migration, runs everywhere including production)

The single `site_settings` row, with safe defaults: a neutral tagline, the Instagram handle `aayatcreativestudio`, a clearly temporary About text, WhatsApp and contact email empty ([ASSUMPTION]). The owner edits these in the admin area. A launch check confirms the About text is no longer the default.

### 13.4 Development seed data (local only)

- `seed.sql` is never run against dev or production projects. It runs only on the local stack.
- Contents: a handful of invented items (all categories, some featured, one unpublished), their image rows pointing at placeholder files, two testimonials, and a few invented enquiries in each status. Placeholder files are uploaded by a local helper script.
- Every sample title and name starts with `[SAMPLE]`. A launch check counts rows starting with `[SAMPLE]` in production and requires zero (DESIGN governance: placeholders never ship).
- No real names, emails or enquiry text. Ever.

### 13.5 Per-environment setup (manual, documented in the README)

| Step | Why not a migration |
|---|---|
| Create the admin user in Auth and insert its ID into `private.admin_users` | The user ID differs per environment |
| Store the project URL and the cron shared secret in Vault | Values differ per environment and must not be in the repository |
| Set Edge Function secrets | Secrets never live in the repository |
| Disable public sign-ups, add the password-reset redirect URL | Auth settings (ARCHITECTURE section 7.2) |

### 13.6 Changing the schema safely (expand, then contract)

1. **Additive first**: add new columns as nullable or with defaults, add new tables, add enum values. Deploy.
2. **Backfill** existing rows inside the migration (tables are tiny).
3. **Switch** the application to the new shape. Deploy.
4. **Remove** the old shape in a later migration.

Before any destructive migration (drop, rename, type change) take a backup (section 14.3) and rehearse it on the dev project.

The backend (migrations and functions) is deployed before the site, so the new site never calls a schema that does not exist yet (ARCHITECTURE section 15.1).

### 13.7 Migration verification

CI replays all migrations from an empty database, runs `rls_audit()` (must return nothing), runs the database tests in section 15, and confirms there is no schema drift.

---

## 14. Backup and Recovery

### 14.1 What needs protecting

| Asset | Loss impact | Protection |
|---|---|---|
| `enquiries` | Lost leads, hard to recreate | Daily backup, plus every enquiry is emailed to the owner |
| Portfolio, testimonials, settings rows | Site content disappears (recreatable from the owner's own materials, but slow) | Daily backup |
| Storage files (images) | Broken images on the site | Not covered by database backups (verify at setup). Originals are the owner's own design files. |
| Auth user, `admin_users` row | Admin locked out | Daily backup. Admin can be recreated by the manual setup in 13.5. |
| Schema | Rebuildable | The migrations in the repository |

### 14.2 Targets [ASSUMPTION]

| Target | Value |
|---|---|
| Recovery point objective (maximum data loss) | 24 hours for content and enquiries, close to zero for notified enquiries (email copy) |
| Recovery time objective | 4 hours |

### 14.3 Backup approach [DECISION NEEDED DB-7]

- Managed daily backups require the Pro plan (retention of about 7 days, verify at setup). The Free plan has no managed backups, which is why production must not run on Free (AD-4).
- Before every destructive migration and before launch: take a manual full export of schema and data and keep it in the owner's private storage, not in the repository (it contains personal data).
- Storage files: keep the original design files, as the owner already does. A periodic bulk export of the bucket is a Future item if the originals are ever not kept.
- Point-in-time recovery is a paid add-on and is not needed at this scale.

### 14.4 Recovery procedure (summary)

1. Decide the restore point. Announce a brief maintenance period (the site can keep serving cached static pages).
2. Restore the managed backup (or import the manual export) to the production project, or to a new project if the old one cannot be used.
3. Re-apply any migrations newer than the backup.
4. Re-check the manual setup: admin user and `admin_users` row, Vault secrets, function secrets, cron jobs, Auth settings.
5. Run `rls_audit()` and the smoke tests (admin login, public list, submit a test enquiry, email arrives).
6. Reconcile files: check that every path in the database exists in Storage. Re-upload from the owner's originals where missing.
7. If a new project was used, update the site configuration to the new project URL and key.

### 14.5 Drills and privacy

- Before launch: restore the latest backup into the dev project once, run steps 3 to 6, and record the time taken.
- Privacy: deleted enquiries remain in backups until those backups expire (about 7 days). Backups containing personal data are protected like production data and never copied to development.

---

## 15. Verification and Traceability

### 15.1 Journey coverage

| Journey | Data used |
|---|---|
| J1 Instagram visitor to enquiry | Q1, Q2, Q3 (read), Q5 to Q8 (enquiry, rate limit, notification) |
| J2 Referred prospect | Q1, Q2, Q4 |
| J3 Owner manages content | Q9, Q10, Q12, Q14, Q13, Storage policies |
| J4 Owner handles an enquiry | Q11, `notified_at` for the "Email not sent" indicator (PRD amendment A7 in ARCHITECTURE) |

### 15.2 Must-pass database tests (launch gates)

*Written in JavaScript against the local Supabase stack, run in CI. They extend the gates in ARCHITECTURE section 14.2.*

1. The anonymous role cannot read enquiries, cannot reach private tables, cannot read unpublished items, images of unpublished items or any unpublished testimonials, and cannot insert, update or delete anywhere.
2. An authenticated user who is not in `admin_users` has no admin access to any table, function or Storage path.
3. The admin can create, edit, delete and publish items, images and testimonials, and update settings. The admin cannot insert or delete the settings row.
4. Publishing fails without alt text. Publishing fails without an image. Removing the last image of a published item fails. Deleting a published item succeeds (the cascade is not blocked).
5. The slug is generated from the title, collisions get a suffix, and the slug cannot change after first publish.
6. The admin can change an enquiry's `status` and no other column. The admin cannot insert an enquiry.
7. Every enquiry constraint rejects the invalid cases in the shared test vectors (lengths, email format and control characters, reference link scheme, phone format, enum values) and accepts the valid ones.
8. Inserting the same enquiry ID twice leaves one row (when done through the function path).
9. `check_rate_limit` allows five calls per caller per hour, rejects the sixth, enforces the daily global ceiling, and is not callable by the anonymous or authenticated roles.
10. `move_portfolio_item` and `move_testimonial` swap order correctly, do nothing at the ends, and do nothing for a non-admin.
11. `rls_audit()` returns no tables. Every public function has only the execute permissions in 10.4.
12. Migrations replay from empty without errors, and no schema drift is reported.
13. Storage: the admin can upload an allowed file within the size limit. Others cannot upload. Wrong types and oversize files are rejected. Anonymous listing of the bucket returns nothing.

---

## 16. Required Amendments to Other Documents

| # | Document | Amendment |
|---|---|---|
| A1 | ARCHITECTURE 6.1, 6.4, 7.3 | `rate_limits` and `admin_users` live in the non-exposed `private` schema, reachable only through functions. This is safer than relying on RLS and grants alone. |
| A2 | ARCHITECTURE 6.4 | Remove the composite `published + sort_order` indexes. They are premature for tables of about 100 rows. Index decisions are in 9.3. |
| A3 | ARCHITECTURE 6.1, 6.3 | The settings table is a singleton keyed by a boolean. Image variants are stored as paths. |
| A4 | ARCHITECTURE 7.4 and the image pipeline | Allow WebP and JPEG in the bucket. Some browsers (notably Safari) cannot encode WebP in the browser, so the admin pipeline needs a JPEG fallback (DB-3). Verify at implementation. |
| A5 | ARCHITECTURE 8.3 and 6.1 | The retry job processes enquiries created in the last 7 days only. Admin shows "Email not sent" for older unnotified enquiries. |
| A6 | ARCHITECTURE (whole document) | Revise for plain HTML, CSS and JavaScript (the owner's constraint): replace React, Vite and TypeScript with a multi-page site using native ES modules and CSS files, Edge Functions in JavaScript, JavaScript database tests. |
| A7 | PRD section 7 | Testimonial `brand_name` optional. New fields: `image_alt` (testimonials), `about_photo_alt` (settings), `first_published_at` (internal), `notified_at` (enquiries), image `image_order`, `width`, `height`, `variants`. `budget_range` is free text validated by the contract. Remove `imageUrl` in favor of storage paths. |
| A8 | DESIGN 8.9 and 10.5 | Testimonial screenshots and the About photo require alt text, entered in admin. |

---

## 17. Decisions Requiring Approval

| # | Decision | Default if unanswered |
|---|---|---|
| DB-1 | Budget range options: validated by the contract (text column), not by a database list (depends on AD-10) | Text column, contract validated |
| DB-2 | Testimonial `brand_name` is optional (only name and quote required) | Optional |
| DB-3 | Allow JPEG as well as WebP in the image bucket (fallback for browsers that cannot encode WebP) | Both allowed |
| DB-4 | Internal tables (`rate_limits`, `admin_users`) in a non-exposed `private` schema (amends ARCHITECTURE) | Yes |
| DB-5 | Enquiry retention (PRD D7): keep until manually deleted. Alternative: automatic deletion after a chosen number of months. | Keep until manually deleted |
| DB-6 | Hard delete (no soft delete or trash) for items, testimonials and enquiries, with a confirmation dialog in the UI and backups as the safety net | Hard delete |
| DB-7 | Backup approach: Pro plan managed daily backups plus a manual export before destructive migrations and launch | As described in 14.3 |
| DB-8 | Categories as a fixed enum (Ads, Posters, Social Media) rather than an editable table | Enum |

---

## 18. Assumptions Summary

1. One admin, one studio, one language. No visitor accounts.
2. Fewer than about 100 portfolio items, fewer than 50 testimonials, and enquiries in the tens to low hundreds per year, with a worst case of about 36,000 per year under abuse.
3. Text length limits (for example quote 600, title 120, description 500, alt text 300) are sensible starting points and can be tuned by migration.
4. WhatsApp numbers are stored as digits in international format without a plus sign.
5. Cross-field and cross-table business rules (publish requirements, slug immutability) belong in the database, because the admin writes to it directly from the browser.
6. Supabase behaviors stated here (backups only on Pro, backups excluding Storage files, Pro backup retention, Vault and cron availability, default function privileges, the Data API row limit, bucket type and size limits) come from knowledge that may be out of date. Verify each at project setup.
7. The project is built in plain HTML, CSS and JavaScript, so the browser reaches the database through the Data API with `fetch` and, for admin pages, the Supabase client. No ORM, no generated types.
8. Time zone display is handled in the browser. The database stores UTC only.
