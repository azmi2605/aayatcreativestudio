# PRD: Aayat Creative Studio Website

| Field      | Value                                      |
|------------|--------------------------------------------|
| Product    | Aayat Creative Studio (@aayatcreativestudio) |
| Owner      | Azmiya                                     |
| Version    | 0.2 (Decisions resolved — approved for build) |
| Audience   | Owner and coding agent. This file is the source of truth. |

> All `[DECISION NEEDED]` items from v0.1 have been resolved and are recorded below.  
> `[ASSUMPTION]` items that were not contradicted remain in effect.

---

## 1. Overview

### 1.1 What is being built

A mobile-first portfolio and lead-generation website for **Aayat Creative Studio**, a solo design business that creates ads, posters and social-media creatives for product brands. The studio is currently run entirely through Instagram.

**D1 — RESOLVED:** The product is a public portfolio + lead-generation website.

### 1.2 Problem

- All discovery, proof of work and enquiries currently depend on Instagram DMs. Work is buried in the feed and hard to browse by category.
- Brands that vet vendors off-platform have no professional, shareable link showing the work, the services and a clear way to hire.
- DM enquiries arrive unstructured (no budget, deliverables or brand details), requiring several back-and-forth messages.

### 1.3 Value proposition

> "See the studio's best ad and poster work in under a minute, then send a clear project brief in under two."

- **For brands:** fast proof of quality, clear services and an easy, structured way to enquire.
- **For the owner:** a credible link for the Instagram bio, pitches and LinkedIn, plus structured enquiries instead of vague DMs.

### 1.4 Target users

| User | Description | Primary need |
|------|-------------|--------------|
| Product brand owner / marketer (primary) | Small and mid-size D2C or product brands, arriving from Instagram | Judge quality fast, then contact easily |
| Referred prospect | Reached via a shared link, LinkedIn or word of mouth | Credibility and a clear next step |
| Studio owner (Admin) | Azmiya | Update work and read enquiries without touching code |

[ASSUMPTION] Most traffic comes from Instagram on phones, so mobile is the primary design target.

---

## 2. Goals and Success Criteria

### 2.1 Goals

1. Present the portfolio professionally and make it easy to browse.
2. Convert visitors into structured project enquiries.
3. Let the owner manage content on her own, with no developer needed after launch.

### 2.2 Success criteria (first 60 days after launch)

| Metric | Target |
|--------|--------|
| Enquiry form completion rate (form starts → submits) | ≥ 40% |
| Enquiries received via the site | ≥ 8 in 60 days |
| Mobile Lighthouse Performance score (home page) | ≥ 85 |
| Admin can add a new portfolio item without help | < 5 minutes |
| Enquiry notification delivered to owner | Within 1 minute, 100% of submissions |
| Critical bugs open at launch | 0 |

---

## 3. Roles and Permissions

| Capability | Visitor (anonymous) | Admin (owner) |
|------------|---------------------|---------------|
| View all public pages | ✅ | ✅ |
| Submit enquiry form | ✅ | ✅ |
| Log in to admin area | ❌ | ✅ |
| Create / edit / delete / publish portfolio items | ❌ | ✅ |
| Create / edit / delete / publish testimonials | ❌ | ✅ |
| View and update enquiry status | ❌ | ✅ |
| Edit site settings (contact links, about text) | ❌ | ✅ |
| Read enquiry data | ❌ | ✅ |

- There is one admin account. No multi-user roles and no client accounts in MVP.
- Visitors can never read, edit or list enquiries or unpublished content. This must be enforced server-side, not only in the UI.

---

## 4. User Journeys and Stories

### 4.1 Core journeys

**J1: Instagram visitor → enquiry (primary)**
1. Taps the website link in the Instagram bio.
2. Lands on the Home page and sees the hero, featured work and services.
3. Opens a portfolio item to view it larger (own page at `/work/:slug`).
4. Taps "Start a Project" and fills in the brief form.
5. Sees a confirmation message. The owner is notified.

**J2: Referred prospect → quick credibility check**
1. Opens the link and scans the portfolio filtered by category.
2. Reads the About and Testimonials sections (on the Home page).
3. Contacts via the form or Instagram DM.

**J3: Owner manages content**
1. Logs in to the admin area.
2. Uploads a new design, adds title, category and description, then publishes.
3. It appears on the public portfolio.

**J4: Owner handles an enquiry**
1. Receives a notification email at `aayatcreativestudio@gmail.com`.
2. Opens the enquiry in admin and reads the brief.
3. Replies externally (email or Instagram) and marks the status.

### 4.2 User stories

**Visitor**
- **US-1** As a brand owner, I want to see the best work immediately so I can judge the studio's quality quickly.
- **US-2** As a brand owner, I want to filter work by type (ads, posters, social media) so I can see relevant examples.
- **US-3** As a brand owner, I want to view a design at full size so I can judge the detail.
- **US-4** As a brand owner, I want to understand what services are offered and their starting prices so I know if the studio fits my budget.
- **US-5** As a brand owner, I want to send a project brief in one short form so I don't need long DM threads.
- **US-6** As a brand owner, I want a confirmation after submitting so I know the message was received.
- **US-7** As a visitor, I want to reach the studio on Instagram directly if I prefer.
- **US-8** As a visitor, I want to read feedback from past clients so I can trust the studio.

**Admin**
- **US-9** As the owner, I want to log in securely so only I can manage the site.
- **US-10** As the owner, I want to add, edit, reorder, hide and delete portfolio items so the site stays current.
- **US-11** As the owner, I want to manage testimonials so I can showcase client feedback.
- **US-12** As the owner, I want to see all enquiries in one list with a status so I never lose a lead.
- **US-13** As the owner, I want to be notified instantly of a new enquiry so I can respond fast.
- **US-14** As the owner, I want to edit contact links and the About text without code changes.

---

## 5. Features and Functional Requirements

### 5.1 Public site

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1 | Home page has a hero (studio name, one-line value statement, primary CTA "Start a Project"), a featured work grid (admin-flagged items), a services summary **with starting prices**, testimonials and a closing CTA. | Must |
| FR-2 | Portfolio page lists all published items in a responsive grid, newest first by default (admin can set manual order and "featured" flag). | Must |
| FR-3 | Portfolio category filter. Initial categories: Ads, Posters, Social Media. Filter changes the list without a full page reload and updates the URL (shareable). | Must |
| FR-4 | Portfolio item detail view at `/work/:slug` shows full-size image(s), title, brand/client name, category and short description. Includes previous/next navigation and a "Start a Project" CTA. | Must |
| FR-5 | Services section on the Home page lists each service with a short description, deliverables and **starting price**. Content is stored in a config file or site settings. | Must |
| FR-6 | About section on the Home page: short bio, optional photo and studio approach. Content is editable via site settings. | Must |
| FR-7 | Testimonials section shows published testimonials (text, name, brand, optional image/screenshot). | Should |
| FR-8 | Contact / enquiry form (see 5.2). | Must |
| FR-9 | Persistent contact option: Instagram link (@aayatcreativestudio). WhatsApp is **not included** (D3). | Must |
| FR-10 | Responsive navigation (mobile menu), footer with social links and copyright. | Must |
| FR-11 | Basic SEO: unique page titles and meta descriptions, Open Graph image for link previews, sitemap and robots.txt, descriptive alt text for design images. | Must |
| FR-12 | Custom 404 page with a link back to Home. | Should |
| FR-13 | Google Analytics (GA4) integration for tracking visits and form conversions (D8). | Must |

### 5.2 Enquiry form

| ID | Requirement |
|----|-------------|
| FR-14 | Fields: Name (required), Brand name (required), Email (required), WhatsApp/phone (optional), Service needed (required, select: Ad creatives / Poster design / Social media design / Other), Project details (required, 20–1000 chars), Budget range (optional, select), Reference link (optional, URL), Timeline / deadline (optional). |
| FR-15 | Client-side validation with inline, field-level error messages, plus the same validation server-side. |
| FR-16 | Spam protection: honeypot field plus rate limiting. No CAPTCHA at launch (D4). |
| FR-17 | On success: show a confirmation message and clear the form. Prevent double submission (disable button while sending). |
| FR-18 | On success: store the enquiry and notify the owner by email at `aayatcreativestudio@gmail.com` (D5). |

### 5.3 Admin area

| ID | Requirement |
|----|-------------|
| FR-19 | Admin login with email and password. Admin routes are inaccessible and not linked from public navigation. Provide logout and password reset flow. |
| FR-20 | Portfolio management: create, edit, delete, publish/unpublish, mark as featured, reorder. Fields in section 7. Image upload with preview. |
| FR-21 | Testimonial management: create, edit, delete, publish/unpublish. |
| FR-22 | Enquiry inbox: list newest first, with status filter (New / Contacted / Closed), detail view, status change and delete. Read-only otherwise. |
| FR-23 | Site settings: edit About text, tagline, Instagram handle, public contact email. |
| FR-24 | Confirmation dialog before any destructive action (delete). |

---

## 6. Pages / Screens

### 6.1 Public

| Screen | Route | Key content |
|--------|-------|-------------|
| Home | `/` | Hero, featured work, services (with starting prices), testimonials, about, CTA |
| Portfolio | `/work` | Category filter, grid, item cards |
| Item detail | `/work/:slug` | Full image(s), metadata, CTA |
| Contact / Start a Project | `/contact` | Enquiry form, Instagram link |
| Not found | `*` | 404 message and link home |

### 6.2 Admin

| Screen | Route | Key content |
|--------|-------|-------------|
| Login | `/admin/login` | Email and password, reset link |
| Dashboard / portfolio list | `/admin` | Items table with publish toggle, add button |
| Portfolio editor | `/admin/work/new`, `/admin/work/:id` | Form and image upload |
| Testimonials | `/admin/testimonials` | List and editor |
| Enquiries | `/admin/enquiries`, `/admin/enquiries/:id` | List, filter, detail, status |
| Settings | `/admin/settings` | Site settings form |

---

## 7. Data Requirements

### PortfolioItem

| Field | Type | Notes |
|-------|------|-------|
| id | string | Unique |
| title | string | Required |
| slug | string | Unique, URL-safe |
| clientBrand | string | Required |
| category | enum | Ads / Posters / Social Media |
| description | string | Optional, ≤ 500 chars |
| images | list of URLs | ≥ 1 required; first is the cover |
| imageWidth | number | Width in px of the cover image (required for masonry grid — DESIGN DD-3) |
| imageHeight | number | Height in px of the cover image (required for masonry grid — DESIGN DD-3) |
| altText | string | Required for accessibility |
| featured | boolean | Default false |
| published | boolean | Default false |
| sortOrder | number | For manual ordering |
| createdAt / updatedAt | timestamp | System-set |

### Testimonial
`id`, `authorName`, `brandName`, `text` (required), `imageUrl` (optional), `published`, `sortOrder`, `createdAt`

### Enquiry
`id`, `name`, `brandName`, `email`, `phone` (optional), `service`, `projectDetails`, `budgetRange` (optional), `referenceLink` (optional), `timeline` (optional), `status` (New / Contacted / Closed; default New), `createdAt`

### SiteSettings (single record)
`tagline`, `aboutText`, `aboutPhotoUrl` (optional), `instagramHandle`, `contactEmail`

### Services
Static content (stored in a config/settings file, not a CRUD entity in MVP). Each service includes: name, description, deliverables list, starting price.

### Data rules
- Enquiries contain personal data (name, email, phone). Visible only to Admin.
- Only items with `published = true` are returned to the public.
- Image requirements: JPG/PNG/WebP, max 5 MB per upload. System serves optimized sizes.
- Enquiry data retained until manually deleted by admin (D7).

---

## 8. Tech Stack (RESOLVED — D9)

**D9 — RESOLVED:** Plain HTML, CSS and vanilla JavaScript. No framework. No build tool required. Backend is **Supabase**.

| Layer | Technology |
|-------|-----------|
| Front end | HTML5, CSS3 (vanilla), vanilla JavaScript (ES modules) |
| Database | Supabase (PostgreSQL via Supabase JS client) |
| Auth | Supabase Auth (email/password) |
| File storage | Supabase Storage (portfolio images, about photo) |
| Hosting | Netlify or Vercel (static hosting, free tier) |
| Email notification | Supabase Edge Function → Resend (or SMTP) on enquiry insert |
| Analytics | Google Analytics GA4 |
| Image CDN | Supabase Storage public bucket (CDN URLs built-in) |

### Integrations

| Integration | Purpose | MVP? |
|-------------|---------|------|
| Instagram (outbound link) | Link to the profile | Yes |
| Email notification | Notify owner of new enquiries via Supabase Edge Function | Yes |
| Supabase Storage | Host and serve portfolio images | Yes |
| Supabase Auth | Admin login | Yes |
| Google Analytics GA4 | Measure visits and conversions | Yes |
| WhatsApp click-to-chat | Alternate contact | **No** (D3) |

---

## 9. Loading, Empty and Error States

| Area | Loading | Empty | Error |
|------|---------|-------|-------|
| Home featured work | Skeleton cards | Section hidden | Section hidden; rest of page renders |
| Portfolio grid | Skeleton grid | "New work coming soon" message | "Couldn't load work" + Retry button |
| Filter with no matches | n/a | "No work in this category yet" + clear-filter link | n/a |
| Item detail | Image placeholder / spinner | n/a | "This work isn't available" + back link |
| Images | Blur placeholder; lazy loaded | Placeholder if image missing | Fallback placeholder; never a broken-image icon |
| Testimonials | Skeleton | Section hidden | Section hidden |
| Enquiry form submit | Button disabled with "Sending…" | n/a | "Something went wrong. Your message was not sent." + retry + Instagram fallback. Entered data is preserved. |
| Form validation | n/a | n/a | Inline messages beside the offending fields |
| Admin lists | Skeleton rows | "No items yet" + Add button | Error banner + Retry |
| Admin save/upload | Progress indicator | n/a | Clear message (file too large, wrong type, network). Unsaved input preserved. |
| Login | Button loading state | n/a | "Invalid email or password" (generic) |
| Offline | n/a | n/a | Non-blocking "You're offline" notice |

---

## 10. Non-Functional Requirements

### Performance
- Mobile Lighthouse Performance ≥ 85 on Home and Portfolio.
- LCP ≤ 2.5s on a typical 4G connection.
- Images lazy-loaded, responsive sizes, WebP where supported.

### Responsiveness and compatibility
- Mobile-first. Fully usable from 320px to desktop.
- Latest two versions of Chrome, Safari (incl. iOS), Edge and Firefox.

### Accessibility
- WCAG 2.1 AA: keyboard navigable, visible focus, sufficient contrast, alt text on all design images, labelled form fields.

### Security and privacy
- HTTPS only.
- Firestore and Storage security rules enforce permissions in section 3.
- Server-side validation and sanitization of all form input.
- No secrets or API keys in client code beyond public Firebase client config.
- Short privacy note near the enquiry form (D10 — no full Privacy Policy page at launch).

### Reliability
- A form submission must never be silently lost.
- README covers environment variables, run and deploy.
- Content changes require no code deploy.

### SEO
- Descriptive `<title>` and `<meta description>` per page.
- Open Graph tags on Home and Portfolio.
- `sitemap.xml` and `robots.txt`.
- Descriptive alt text on all portfolio images.

### Cost
- Must run within free/low-cost Firebase tiers at expected traffic (low hundreds of visits/week).

---

## 11. Design Direction

- **Style:** Light, clean and minimal — white backgrounds, elegant typography.
- **Typography:** Premium Google Fonts (e.g. Playfair Display for headings, Inter for body).
- **Color palette:** Neutral whites and off-whites, soft warm accents, dark charcoal for text. No plain/generic colors.
- **Motion:** Subtle micro-animations, smooth scroll, fade-in on scroll.
- **Primary CTA color:** To be derived from brand identity (a warm accent — e.g. a muted gold or terracotta).
- **Mood:** Studio-like, premium, tasteful — feels like a boutique creative agency.

---

## 12. MVP Scope

### 11.1 In scope
- Home (hero, featured work, services with prices, testimonials, about, CTA)
- Portfolio page with category filter and item detail pages
- Contact page with enquiry form
- Admin: login, portfolio CRUD with image upload, testimonial CRUD, enquiry inbox, site settings
- Google Analytics GA4
- Basic SEO, 404 page
- All loading, empty and error states in section 9

### 11.2 Out of scope
- WhatsApp link
- Online payments, invoicing or quotes
- Client portal, file sharing, proofing/approvals
- Booking/calendar scheduling
- Blog / CMS articles
- Live chat or chatbot
- Instagram API feed sync
- Multi-language support
- Multiple admin users
- E-commerce / digital products
- Email marketing / newsletter
- Dark mode toggle
- Pricing calculator

---

## 13. Decisions — All Resolved

| # | Decision | Resolution |
|---|----------|-----------|
| D1 | Product type | Portfolio + lead-gen website ✅ |
| D2 | Portfolio item detail | Own page at `/work/:slug` ✅ |
| D3 | WhatsApp | Not included ✅ |
| D4 | CAPTCHA | No — honeypot + rate limit only ✅ |
| D5 | Notification email | `aayatcreativestudio@gmail.com` ✅ |
| D6 | Services / About placement | Home page sections ✅ |
| D7 | Enquiry data retention | Until manually deleted ✅ |
| D8 | Analytics | Google Analytics GA4 ✅ |
| D9 | Tech stack | HTML + CSS + Vanilla JS + **Supabase** ✅ |
| D10 | Privacy policy | Short note near form only ✅ |
| D11 | Public pricing | Yes — show starting prices ✅ |
| D12 | Content readiness | Portfolio images (8–12+) ready; owner to supply text ✅ |
| D13 | Domain | Owner will provide — Netlify/Vercel subdomain in the meantime ✅ |

---

## 14. Definition of Done (MVP)

- [ ] All **Must** requirements in section 5 implemented and passing.
- [ ] Permissions in section 3 enforced and verified with an anonymous-user test.
- [ ] An enquiry submitted on a live phone-sized browser is stored and triggers owner email.
- [ ] Every state in section 9 implemented and manually verified.
- [ ] Mobile Lighthouse Performance ≥ 85 and no critical accessibility violations on Home, Portfolio, Contact.
- [ ] Owner has added and published one portfolio item through admin without developer help.
- [ ] Site deployed over HTTPS; README complete.
