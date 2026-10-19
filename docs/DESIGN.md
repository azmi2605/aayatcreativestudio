# DESIGN.md: Aayat Creative Studio Website

| Field      | Value                                                                 |
|------------|-----------------------------------------------------------------------|
| Product    | Aayat Creative Studio (@aayatcreativestudio)                          |
| Depends on | PRD.md v0.2 (requirement IDs such as FR-3 refer to it)               |
| Version    | 0.2 (Draft for approval). Rebuilt around the supplied logo.           |
| Audience   | Owner and coding agent. This file is the single source of truth for visual design and UX. |

**Legend**

- `[ASSUMPTION]`: assumed because it was not specified. Correct it if wrong.
- `[DECISION NEEDED DD-n]`: the owner must approve before it is built. Defaults are listed in section 17.
- **Token**: a named design value (color, size, spacing). Components must use tokens, never raw values. Changing a token changes the whole site.

**What changed in v0.2**

The supplied logo (AC monogram in a gold ring, deep brown and gold, classic serif wordmark) replaces the placeholder identity. Palette, typefaces, corner radius and tone were rebuilt around it.
- New section 2 defines logo usage.
- Gold is a decorative color only because it fails text contrast on light backgrounds. A darker "gold-deep" handles text links.
- Input border color was darkened. The v0.1 value did not reach the 3:1 contrast needed to identify form controls.
- Sections were renumbered. Decisions were updated (old DD-1 and DD-4 are resolved or reshaped).

---

## 1. Visual Direction

### 1.1 Concept: "A quiet boutique gallery"

This is a portfolio for a designer, and the logo signals a refined, boutique studio. The interface is a warm, calm gallery: cream walls, deep-brown type, thin gold details. The client's ads and posters carry the color and energy, and the UI stays elegant and out of their way.

### 1.2 Personality

Refined, warm, confident, craft-minded. It reads as a skilled independent studio with taste, not a software company and not a template agency.

### 1.3 Design principles

1. **Work first.** Portfolio imagery is always the largest, most colorful thing on screen. UI chrome never competes with it.
2. **One clear next step.** Every screen has one primary action ("Start a Project" for visitors). Never two competing primary buttons in one view.
3. **Mobile first, thumb first.** Design for a phone arriving from Instagram, then scale up.
4. **Consistency over cleverness.** The same component looks and behaves the same everywhere. New patterns need a reason.
5. **Restraint is the luxury.** Two typefaces, a brown-and-gold palette, minimal decoration. Elegance comes from spacing, type and proportion, not ornament.
6. **Fast and honest.** Fast loading is a design feature. Every wait, empty and failure is designed (section 12).

### 1.3.1 Anti-patterns (explicitly forbidden)

- Gold gradients, metallic or foil effects, glow, glassmorphism, floating blobs or abstract 3D shapes. The logo artwork's own ribbon gradient is the only exception because it is part of the supplied asset.
- Ornamental flourishes, filigree, swashes, frames or borders imitating "luxury" templates
- Stock-style illustrations, emoji used as icons, generic "icon in a circle" feature grids
- Centered-everything hero with a stock gradient button
- Auto-playing carousels, parallax, scroll-jacking, cursor effects, animated counters
- Fake logos, fake stats, fake testimonials (placeholder content must be obviously temporary and never ship)
- Heavy shadows and many border radii. Use the few defined here.
- Decorative motion that delays access to content

---

## 2. Brand and Logo

### 2.1 What the supplied logo contains

| Element    | Description                                                                                    | Design consequence                                        |
|------------|-----------------------------------------------------------------------------------------------|----------------------------------------------------------|
| Monogram   | Interlocked "A" and "C" in deep brown, with a gold ribbon crossing them, inside a thin gold ring | Primary brand mark. Used alone for favicon, avatars and compact placements. |
| Wordmark   | "AAYAT" in a high-contrast classic serif, deep brown                                           | Sets the headline voice (section 5)                      |
| Tagline    | "CREATIVE STUDIO" in a light, widely letter-spaced sans, flanked by two short gold rules       | Source of the eyebrow text style and the gold rule motif |
| Colors     | Deep chocolate brown, warm gold, near-white background                                         | Source of the palette (section 4)                        |

### 2.2 Logo variants and where they are used

[DECISION NEEDED DD-1 — **PARTIALLY RESOLVED**] The full stacked lockup has been supplied. Remaining variants still needed — until transparent/SVG versions exist, logos sit on `surface` only.

| Variant | Use | Status |
|---------|-----|--------|
| Full stacked lockup (monogram + AAYAT + CREATIVE STUDIO) | Footer, Open Graph image, About section, Contact page header area | **Supplied** — opaque white bg; must sit on `surface` until a transparent/SVG version is provided. Save to `assets/brand/logo-lockup.png`. |
| Monogram only (ring + AC) | Header on mobile, favicon, admin top bar | **Not yet supplied.** Default: tracked "AAYAT" text until exported. |
| Horizontal lockup (monogram left, wordmark right) | Desktop header | **Not supplied.** Default: "AAYAT" in Cormorant Garamond 600, tracked. |
| Single-color brown version | Print-style contexts, emails, fallback | Not supplied. |
| Simplified favicon (AC without the thin ring) | Browser tab, home-screen icon | Not supplied. Ring disappears at 16–32px; favicon uses AC letters only. |

Required file formats: SVG preferred, otherwise PNG with a transparent background at 2× or larger. The supplied image has an opaque off-white background that would show as a visible box on any other background color. Until a transparent version exists, logos are placed only on `surface` (see 8.3 and 8.4 for header and footer).

### 2.3 Logo usage rules

- **Clear space:** keep a margin on all sides equal to ¼ of the monogram ring's diameter. No text, edges or images inside it.
- **Minimum size:** full lockup ≥ 120px wide. Monogram alone ≥ 40px (the ring is a hairline and breaks up below this). Favicon uses the simplified AC.
- **Backgrounds:** only on `surface` or `bg`. Never on photos, portfolio images, gold areas or gradients. There is no dark theme and no dark sections in MVP, so no reversed logo is required.
- **Never:** recolor, stretch, rotate, outline, add shadows or effects, rebuild the logo in a different font, or crop the ring.
- The logo is never used as decoration (no large faded watermark behind content).
- The logo links to Home everywhere it appears in navigation, with the accessible name "Aayat Creative Studio, home".

### 2.4 Brand values source

[DECISION NEEDED DD-4 — **RESOLVED**] The brand colors and typefaces have been visually confirmed from the supplied logo. The sampled values in sections 4 and 5 are accurate:

- **Brown** `#4A2512` — matches the deep chocolate in the AC monogram and AAYAT wordmark exactly.
- **Gold** `#C9A66B` — matches the ring, the CREATIVE STUDIO text and the decorative rules.
- **Typefaces** — Cormorant Garamond (Display/headings) matches the high-contrast serif AAYAT wordmark; Jost (Body/UI) matches the light tracked CREATIVE STUDIO tagline.

No token changes required. If a print vendor or brand guidelines document later specifies different values, update the tokens in sections 4 and 5 and re-verify all contrast pairs.

---

## 3. Foundations Overview

| Area              | Decision                                                                                                        |
|-------------------|-----------------------------------------------------------------------------------------------------------------|
| Theme             | Single light theme (dark mode is out of scope per PRD 11.2)                                                     |
| Style             | Flat, with whitespace and hairlines for structure instead of shadows                                            |
| Primary action color | Deep brown (`brown`)                                                                                         |
| Gold              | Decorative only: thin rules, never text, never required UI boundaries                                          |
| Corners           | Two radii only (section 6.3). Slightly sharper than typical web UI to suit the classic serif.                   |
| Icons             | One consistent outline icon set, 24px grid, 1.5px stroke ([ASSUMPTION] Lucide or equivalent)                   |
| Imagery           | Portfolio images are shown uncropped wherever possible (section 9.4)                                            |

---

## 4. Color

Values are sampled from the logo (see 2.4) and adjusted where needed to meet accessibility contrast.

### 4.1 Core palette (semantic tokens)

| Token       | Value     | Use                                                                                       |
|-------------|-----------|-------------------------------------------------------------------------------------------|
| `bg`        | `#FBF8F3` | Page background (warm cream)                                                              |
| `surface`   | `#FFFFFF` | Header, footer, cards, form fields, dialogs, admin tables                                 |
| `brown`     | `#4A2512` | Primary text, headings, primary buttons (the logo's deep brown)                           |
| `brown-hover` | `#321707` | Hover and pressed state for brown elements                                              |
| `ink-muted` | `#6B5A4C` | Secondary text, captions, helper text                                                     |
| `line`      | `#E6DDD0` | Dividers, default borders, skeleton base                                                  |
| `line-strong` | `#8C7B68` | Input borders and other control boundaries (≥3:1 on surface and bg)                     |
| `gold`      | `#C9A66B` | Decorative only: short rules, hairline flourishes echoing the logo                        |
| `gold-tint` | `#F3E9D6` | Hover and selected backgrounds, subtle notices                                            |
| `gold-deep` | `#7D5A1B` | Text links and small accent text (≈5.9:1 on bg, ≈5.2:1 on gold-tint)                    |
| `on-brown`  | `#FBF8F3` | Text and icons on brown (≈12.7:1)                                                         |

### 4.2 Status colors

| Token          | Value     | Use                                                          |
|----------------|-----------|--------------------------------------------------------------|
| `success`      | `#2F6B3F` | Success messages, "Published", "Contacted" badges            |
| `success-tint` | `#E3F0E6` | Success banner background                                    |
| `error`        | `#B3261E` | Errors, destructive actions                                  |
| `error-tint`   | `#FBE7E5` | Error banner and field background                            |
| `warning`      | `#8A5A00` | Warnings, "Draft" or "Unpublished" badges                    |
| `warning-tint` | `#FBF0D9` | Warning background                                           |
| `info`         | `ink-muted` | Neutral notices (no extra hue)                             |

### 4.3 Color rules

- Body text is `brown` on `bg` or `surface`. Secondary text is `ink-muted` and never smaller than 14px.
- **Gold is decoration only.** `gold` (`#C9A66B`) fails contrast for text on light backgrounds (below 3:1). It must never carry text, an icon that conveys meaning, a button fill, or the boundary of a form control.
- Text links use `gold-deep`, underlined, on `bg` or `surface` or `gold-tint`. On other colored backgrounds, links use `brown` underlined.
- The primary action color is `brown`, not gold. At most one gold element per section (for example, a short rule above a section title).
- Never use color alone to convey meaning. Pair with an icon and/or text label.
- All text and background pairs meet WCAG 2.1 AA: 4.5:1 for normal text, 3:1 for large text (≥24px, or ≥18.66px bold) and UI boundaries. Re-verify every pair if brand values change (DD-4).
- Portfolio images sit on `bg` or `surface` with no tinted overlays, filters or colored frames.
- Disabled controls: `line` background and `ink-muted` text, with a `not-allowed` cursor on pointer devices. Disabled is for temporary states only (e.g., while submitting).

---

## 5. Typography

### 5.1 Typefaces

[DECISION NEEDED DD-4] These are the closest free matches to the logo's lettering (a classic high-contrast serif and a light, wide sans). Replace if the original fonts are known and licensed for web.

| Role              | Typeface           | Notes                                                                                                             |
|-------------------|--------------------|-------------------------------------------------------------------------------------------------------------------|
| Display / headings | Cormorant Garamond | Elegant classic serif, echoes the AAYAT wordmark. Use only at 22px and above and at weight 500 or 600 (thin weights fail at small sizes). |
| Body / UI         | Jost               | Clean geometric sans, echoes the tracked "CREATIVE STUDIO" tagline, very readable at small sizes                  |
| Fallback stack    | System serif for Display, system sans-serif for Body | Must be specified for both; layout must not break if fonts fail to load |

**Rules:**

- Maximum two families. Weights used: Display 500 and 600; Body 400 and 500.
- Fonts load with a `swap` strategy so text is visible immediately. Load only the weights used.
- All-caps is allowed only for the eyebrow style (short labels, ≤3 words, with letter spacing). Never for body text or buttons.
- Never set the brand name in the Display font to imitate the logo, except the temporary header default in 2.2.

### 5.2 Type scale

Sizes are mobile → desktop (≥1024px). Line heights are unitless. Cormorant has a small x-height, so display sizes are larger than a typical scale.

| Style token | Mobile | Desktop | Font, weight                         | Line height | Use                                     |
|-------------|--------|---------|--------------------------------------|-------------|-----------------------------------------|
| `display`   | 44px   | 80px    | Display 600                          | 1.02        | Home hero headline only                 |
| `h1`        | 36px   | 52px    | Display 600                          | 1.08        | Page titles                             |
| `h2`        | 30px   | 40px    | Display 600                          | 1.12        | Section titles                          |
| `h3`        | 24px   | 28px    | Display 600                          | 1.2         | Card and subsection titles              |
| `eyebrow`   | 14px   | 14px    | Body 500, uppercase, +0.2em tracking | 1.4         | Small label above a section title       |
| `body-lg`   | 18px   | 20px    | Body 400                             | 1.55        | Intro paragraphs, hero subtext          |
| `body`      | 16px   | 17px    | Body 400                             | 1.6         | Default text, form input text           |
| `small`     | 14px   | 14px    | Body 400                             | 1.5         | Captions, helper text, metadata         |
| `label`     | 14px   | 14px    | Body 500                             | 1.4         | Form labels, filters, badges            |
| `button`    | 16px   | 16px    | Body 500                             | 1           | Button text                             |

### 5.3 Typographic rules

- Body paragraph width: max 65 characters (roughly 640px).
- One `h1` per page. Heading levels are never skipped for visual reasons; change the style, not the level.
- Headings are `brown`. Body is `brown`. Secondary text is `ink-muted`.
- Text is left-aligned. Center alignment only for short hero text, confirmation messages and empty states (≤3 lines).
- Form input text is never below 16px (prevents mobile browser zoom on focus).
- Links inside body copy are `gold-deep` and underlined. Navigation links may omit the underline but must show a clear active, hover and focus state.
- The eyebrow style may be flanked by short gold rules (as in the logo tagline), max once per page section.

---

## 6. Spacing, Layout and Shape

### 6.1 Spacing scale (4px base)

| Token    | Value | Typical use                              |
|----------|-------|------------------------------------------|
| `space-1` | 4px  | Icon-to-text gap                         |
| `space-2` | 8px  | Tight groups, label-to-input             |
| `space-3` | 12px | Chip gaps, compact padding               |
| `space-4` | 16px | Default padding, field gap, mobile gutter |
| `space-5` | 24px | Card padding, desktop gutter             |
| `space-6` | 32px | Between related blocks                   |
| `space-7` | 48px | Between sections (mobile)                |
| `space-8` | 64px | Between sections (tablet)                |
| `space-9` | 96px | Between sections (desktop)               |

**Rule:** only these values. No arbitrary pixel values. Generous whitespace is part of the refined look: prefer the larger section spacing over cramming.

### 6.2 Layout grid

| Breakpoint       | Width        | Columns | Gutter | Page margin                       |
|------------------|--------------|---------|--------|-----------------------------------|
| Mobile (default) | 320–639px    | 4       | 16px   | 16px                              |
| Tablet           | 640–1023px   | 8       | 24px   | 32px                              |
| Desktop          | 1024–1279px  | 12      | 24px   | 48px                              |
| Wide             | ≥1280px      | 12      | 32px   | Centered, content max 1200px      |

- Text-heavy pages (About, Services, Contact form) use a narrower reading column (max 720px) even on desktop.
- Portfolio grid may use the full 1200px content width.
- Section spacing uses `space-7` (mobile), `space-8` (tablet), `space-9` (desktop). Related items within a section use `space-5` or `space-6`.

### 6.3 Shape

| Token       | Value | Use                                                                 |
|-------------|-------|---------------------------------------------------------------------|
| `radius-sm` | 2px   | Inputs, buttons, badges, cards, images                              |
| `radius-lg` | 8px   | Dialogs, mobile menu sheet                                          |
| Border      | 1px `line` (default), 1px `line-strong` (inputs), 2px `brown` (focus and selected) | |

### 6.4 Elevation

No decorative shadows. Only two exceptions: dialogs and the mobile menu sheet get a subtle shadow plus a dimmed backdrop (`brown` at ~50% opacity) so they separate from the page. Cards separate by border and whitespace, not shadow.

---

## 7. Iconography

- One outline icon family, 24px default, 20px inside compact controls, 1.5px stroke, `brown` color unless stated.
- Icons accompany text for meaning. Icon-only buttons need an accessible name and a minimum 44×44px tap target.
- Required icons: menu, close, arrow-left/right, external link, Instagram, WhatsApp, check, alert, info, upload, trash, edit, eye/eye-off (publish state), drag handle.
- Social icons use `brown` and show `gold-deep` on hover and focus only. Do not use official brand-color logos.

---

## 8. Components

Each component has one definition. Pages compose these and never restyle them.

### 8.1 Button

| Variant     | Appearance                                  | Use                                                             |
|-------------|---------------------------------------------|-----------------------------------------------------------------|
| Primary     | `brown` fill, `on-brown` text               | The single main action per view ("Start a Project", "Send enquiry", "Save") |
| Secondary   | Transparent, 1px `brown` border, `brown` text | Supporting actions ("View all work", "Cancel")                |
| Text/Link button | `gold-deep` text, underline on hover   | Inline, low-emphasis actions                                    |
| Destructive | `error` fill (confirm dialogs only) or `error` text | Delete, admin only                                      |

**Specs:**

- Height 48px for primary and secondary; 40px for compact admin tables. Horizontal padding `space-5`. Radius `radius-sm`.
- Minimum tap target 44×44px.
- States: default, hover (`brown-hover`; secondary gets `gold-tint` fill), pressed (`brown-hover`), focus (focus ring, section 15), disabled, loading (label replaced or accompanied by a spinner, width unchanged, button disabled, `aria-busy` set).
- Labels are verbs or clear outcomes ("Send enquiry", not "Submit"). Sentence case.
- Buttons that navigate are `<a>` links. Buttons that act are `<button>` elements.

### 8.2 Links

Body links: `gold-deep`, underlined. External links show the external-link icon and open in a new tab only when leaving the site, with an accessible hint. Instagram and WhatsApp links open in a new tab.

### 8.3 Header and navigation (public)

- Background: `surface` with a 1px `line` bottom border (see 2.2 on why logos sit on `surface` until a transparent logo exists).
- Layout: left, logo (links to Home). Right, text links (Work, Services, About, Contact) and the Primary "Start a Project" button.
- Logo in header: monogram (≥40px) on mobile; on desktop, the horizontal lockup if supplied, otherwise monogram plus tracked "AAYAT" text (2.2).
- Mobile (<1024px): logo left; a compact "Start a Project" button and a menu button on the right. The menu opens a full-height sheet with large tappable links (min 56px rows), Instagram link at the bottom, and a clear close button.
- Header height: 64px mobile, 80px desktop. Not sticky on mobile (preserves screen space). Sticky on desktop.
- Current page link: `brown` with a 2px `gold-deep` underline and `aria-current="page"`. Other links: `ink-muted`, hover `brown`.
- If Services and About are Home sections (PRD D6), their nav links scroll to the section; the same visual rules apply.

### 8.4 Footer

`surface` background with a top rule in `gold` (the one gold element for this section). Contains the full stacked lockup (≥120px wide, clear space applied), a one-line studio description, nav links, Instagram link, and copyright. Simple, with no newsletter and no link wall.

### 8.5 Portfolio card

- Image on top at its true aspect ratio (see 9.4), `radius-sm`, with a 1px `line` border so light-edged images do not melt into `bg`.
- Below: title (`h3`) and one line of `small` `ink-muted` metadata (brand · category). No overlays, no hover text covering the image.
- Whole card is one link. Hover (pointer devices): image scales to 1.02 and the title underlines. Focus: focus ring around the card.
- Cover image has descriptive alt text from the item's `altText` field.

### 8.6 Category filter

- Horizontal row of filter buttons: All, Ads, Posters, Social Media. Single-select.
- Style: `label` text, `space-3`/`space-4` padding, `radius-sm`, 1px `line-strong` border, `surface` fill.
- Selected: `gold-tint` fill, 2px `brown` border, medium weight text. The thicker border and the `aria-pressed` state make selection clear without relying on color. Hover (unselected): `gold-tint` fill.
- On mobile the row scrolls horizontally if needed with a visible edge fade-out. Selection updates the URL (PRD FR-3).

### 8.7 Image viewer (item detail)

- **Dedicated page (default, DD-2):** large image at the top, followed by title, brand, category, description, then "Start a Project" CTA and previous/next links.
- Multiple images stack vertically at full width (no carousel). On desktop, images use up to the content width and metadata sits beside or below as defined in 10.3.

### 8.8 Service block

Title (`h3`), one-sentence description (`body`), deliverables as a short plain bullet list (3–5 items). Separated by 1px `line` dividers, laid out as a list on mobile and a 2–3 column grid on desktop. No icon circles.

### 8.9 Testimonial

Quote text in `body-lg`, then author name (`label`) and brand (`small`, `ink-muted`). If a screenshot is supplied, show it at its true size inside a bordered frame, never cropped. No stars unless real ratings exist, no stock avatars.

### 8.10 Form controls (shared by public and admin)

| Control          | Spec                                                                                                   |
|------------------|--------------------------------------------------------------------------------------------------------|
| Label            | `label` style, placed above the field, always visible. Never use a placeholder as the label.           |
| Input / Textarea | Height 48px (textarea min 140px), `surface` fill, 1px `line-strong` border, `radius-sm`, 16px text, `space-4` horizontal padding |
| Select           | Same as input, with a chevron icon; native select behavior preserved on mobile                         |
| Helper text      | `small`, `ink-muted`, directly below the field                                                         |
| Error            | Border becomes 2px `error`; message below the field in `error` with an alert icon; field gets `aria-invalid` and is linked to its message |
| Focus            | Focus ring (section 15)                                                                                |
| Optional marker  | Fields are required by default; mark optional ones with "(optional)" in the label. Do not use asterisks. |
| Character counter | Only on the Project details field; `small`, right-aligned, announced politely                         |
| File upload      | Dashed 1px `line-strong` area, "Choose image" button, supported formats and max size stated; shows thumbnail, filename and a remove control after selection |

### 8.11 Feedback components

| Component     | Use                                                           | Spec                                                                                                                          |
|---------------|---------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| Inline banner | Persistent messages (form-level error, success, warnings)     | Full width of its container; tint background, 1px border in status color, icon + text; `role="status"` (success, info) or `role="alert"` (error) |
| Toast         | Brief admin confirmations ("Saved", "Item deleted")           | Bottom of screen (mobile) or bottom-right (desktop); auto-dismisses after 5s; pauses on hover and focus; has a close button; never used for errors that need action |
| Badge         | Status in admin (Published, Draft, New, Contacted, Closed)    | `label` text, `radius-sm`, status tint background and status text color, always includes the text label                       |
| Dialog        | Destructive confirmation in admin                             | Title states the action and target ("Delete 'Summer Sale Poster'?"), one sentence of consequence, Cancel (secondary, default focus) and Delete (destructive). Esc cancels. |

### 8.12 Skeleton

`line`-colored blocks matching the final shape and size of the content (image area at its aspect ratio, 2–3 text lines for titles). Subtle opacity pulse. No spinners for content areas; spinners only inside buttons or for uploads. Replace with real content without layout shift.

### 8.13 Admin table / list

- Compact rows with 1px `line` dividers, `surface` background. Columns: thumbnail, title, category, status badge, actions.
- On mobile, rows collapse into stacked cards with the same fields.
- Row actions: Edit, Publish/Unpublish, Delete (via menu on mobile). Delete always opens the confirm dialog.
- Reordering: drag handle with a keyboard-accessible alternative (move up/down buttons).

### 8.14 Empty state and error state components

Defined once, used everywhere (rules in section 12). Structure: optional small icon, one-line heading, one-sentence explanation, one action.

### 8.15 Gold rule (decorative motif)

A short horizontal line (48px wide, 2px thick) in `gold`, placed above a section title or beside an eyebrow label, echoing the dashes beside the logo tagline. Decorative: hidden from assistive technology. Max one per section, never used as a divider between content (dividers use `line`).

---

## 9. Imagery and Content Guidelines

### 9.1 Portfolio images

- Display work as designed: never crop, distort, tint or overlay portfolio images in the detail view.
- Grid thumbnails preserve aspect ratio (9.4).
- Always set alt text describing the design (brand, what is shown, style). Decorative images have empty alt.

### 9.2 Image loading performance

- Responsive image sizes with lazy loading below the fold; the first visible images load eagerly.
- Each image reserves its space before loading to prevent layout jumps.
- Placeholder while loading: `line` background (or a very low-detail blur if available).

### 9.3 Microcopy and tone

- Warm, polished and direct. Short sentences. No jargon, no hype ("world-class", "revolutionary"), no overly flowery luxury language.
- Use the same words for the same thing everywhere (always "enquiry" or always "project brief"; decide in copy review).
- Error messages say what happened and what to do next, without blame.
- Primary CTA label is consistently **"Start a Project"**.

### 9.4 Portfolio grid image treatment

[DECISION NEEDED DD-3] Designs vary in shape (portrait posters, square ads). Two options:

- **A (default):** Preserve each image's true aspect ratio in a masonry-style grid (columns of varying-height cards). Best for a designer's work, but requires image width and height to be stored per image (an amendment to the PRD data model, section 7).
- **B:** Fixed 4:5 frames with the image shown fully inside (letterboxed on `surface`). Simpler, no data change, but leaves uneven empty space around some work.

Default if unanswered: **A**.

---

## 10. Page-Level Layout Guidance

Common rules: one `h1` per page; sections separated by the section spacing rule (6.2); primary CTA appears at least once per page; no page exceeds the 1200px content width.

### 10.1 Home (/)

- **Hero:** eyebrow ("Ads and poster design"), display headline stating what the studio does and for whom, one `body-lg` supporting line, primary "Start a Project" and secondary "View work". Left-aligned. A strong portfolio image or small image cluster sits beside (desktop) or below (mobile) the text, not a decorative graphic and not the logo. Hero text must be visible without scrolling on a 375×667px viewport.
- **Featured work:** 6–8 featured items in the portfolio grid, with a "View all work" secondary button.
- **Services summary:** the 3 services as compact service blocks (8.8), linking to Contact or the Services section.
- **Testimonials:** 2–3 testimonials (hidden if none).
- **Closing CTA:** one sentence plus primary "Start a Project" button, with the Instagram link beneath.

### 10.2 Portfolio (/work)

`h1` "Work", filter row (8.6), result grid. Desktop: 3 columns (4 on wide). Tablet: 2. Mobile: 1 column. Cards keep consistent gaps of `space-5`. The page ends with the closing CTA block.

### 10.3 Item detail (/work/:slug)

- Back link ("← All work", preserving the filter and scroll position).
- Image(s) first, at maximum available width.
- Below (mobile) or beside (desktop, ~⅓ column): `h1` title, brand and category metadata, description.
- Previous and next links beneath, then the "Start a Project" CTA.

### 10.4 Services (Home section)

Intro line, the service list (8.8), a short "How it works" in 3 numbered plain-text steps (brief, draft, final) [ASSUMPTION — only if the owner confirms the process, DD-6], then a CTA. Pricing shown per PRD D11.

### 10.5 About (Home section)

Reading column. Photo (if supplied, restrained size, not a circle avatar [ASSUMPTION]), short bio, studio approach in 2–3 short paragraphs, the full stacked lockup near the top or bottom, Instagram link, CTA.

### 10.6 Contact / Start a Project (/contact)

Two-part layout on desktop: left, reading column with a short promise ("Tell us about your brand and what you need"), a "what happens next" note and alternative contacts (Instagram); right, the enquiry form. On mobile, the intro is short and the form follows immediately. The form is single column on all sizes.

### 10.7 404

`h1`, one line of explanation, primary "Back to home" button, secondary link to Work.

### 10.8 Admin (all /admin/*)

- Same tokens and components as the public site, but denser (compact buttons, table rows) and with no hero and no marketing styling.
- Persistent top bar on `surface`: monogram, nav (Work, Testimonials, Enquiries, Settings), "View site" link, Logout. On mobile, nav collapses into a menu.
- **Login:** centered single card, monogram above the form, 2 fields, primary button, reset link.
- **Portfolio list:** page title, primary "Add item", table (8.13).
- **Editor:** single column form grouped into "Images", "Details", "Visibility". Sticky bottom action bar on mobile with Save (primary) and Cancel (secondary). Live image preview.
- **Enquiries:** status filter above a list; list rows show name, brand, service, date and status badge; the detail view is a read-only layout with a status control and `mailto:` links for replying.
- **Settings:** single column form with a Save button; success shown with a toast.

---

## 11. Navigation and Forms Behavior

### 11.1 Navigation behavior

- Navigation labels: Work, Services, About, Contact. No dropdowns.
- Route changes move focus to the page `h1` and scroll to top. Filtering and back navigation restore scroll position.
- Instagram is available in the footer and on the Contact page; the header carries only the primary CTA.
- The admin area is not linked from any public page.

### 11.2 Enquiry form behavior (PRD FR-13 to FR-17)

- Fields appear in this order: Name, Brand name, Email, WhatsApp/phone (optional), Service needed, Project details, Budget range (optional), Reference link (optional), Timeline (optional).
- Use proper input types and keyboard hints (`email`, `tel`, `url`) so mobile keyboards match.
- Validation timing: validate a field when the user leaves it; once a field shows an error, re-validate as they type so the error clears immediately. Do not show errors on untouched fields.
- Submit with errors: show a form-level error banner at the top ("Please fix 2 fields to continue"), move focus to the first invalid field, and keep all entered data.
- On submit: the primary button enters the loading state and the form keeps its data. Prevent double submission.
- On success: replace the form with a confirmation panel (heading "Thanks, we've got your brief", what happens next, a note about response time [ASSUMPTION — wording to be confirmed by the owner, DD-7], and links to Home and Work). Move focus to the confirmation heading. The panel does not auto-dismiss.
- On failure: inline banner with a retry action and Instagram fallback; all data preserved (PRD section 9).
- The honeypot spam field is visually hidden and removed from assistive technology and tab order.
- A one-line privacy note sits directly beneath the submit button (PRD NFR).

### 11.3 Admin form behavior

- Required fields follow the same rule as 8.10.
- Unsaved changes: if the user tries to leave an edited form, show a confirmation dialog.
- Save success: toast. Save failure: inline banner at the top of the form with data preserved.
- Image upload: show a progress indicator, then a thumbnail; reject files over the size limit or of the wrong type with a specific message.

---

## 12. Loading, Empty and Error States

These mirror PRD section 9 and define how each looks. Use the shared components (8.12 to 8.14).

### 12.1 Rules

- **Loading:** use skeletons shaped like the final content for lists, grids and detail views; spinners only in buttons and uploads. Never show a blank page. If loading finishes in under ~300ms, avoid flashing the skeleton.
- **Empty:** every empty state has a heading, one helpful sentence and, where possible, one action. Public empty states stay on-brand and calm; admin empty states emphasize the next action.
- **Error:** plain language, say what failed and what to do, offer Retry where it can help, never show technical messages or stack traces. Failure of one section must not break the whole page.
- Errors that need attention use `role="alert"`; non-urgent changes use `role="status"`.

### 12.2 State specification

| Area                  | Loading                            | Empty                                                        | Error                                                                  |
|-----------------------|------------------------------------|--------------------------------------------------------------|------------------------------------------------------------------------|
| Home featured work    | Skeleton cards in the grid layout  | Whole section hidden                                         | Whole section hidden; rest of page unaffected                          |
| Portfolio grid        | Skeleton grid (same column count)  | Centered: "New work coming soon." plus Instagram link        | Banner-style state: "We couldn't load the work." with Retry            |
| Filter with no results | n/a                               | "No work in this category yet." with a "Show all work" link  | n/a                                                                    |
| Item detail           | Image-sized skeleton plus text lines | n/a                                                        | "This work isn't available." with a back-to-work link                  |
| Images                | `line` placeholder, fade in on load | `line` placeholder with no broken icon                      | Same placeholder; alt text remains                                     |
| Testimonials          | 2 skeleton quote blocks            | Section hidden                                               | Section hidden                                                         |
| Enquiry form          | Button loading ("Sending…")        | n/a                                                          | Banner with retry and fallback contact; data preserved                 |
| Admin lists           | Skeleton rows                      | "No items yet" with a prominent Add button; "No enquiries yet" | Error banner with Retry                                              |
| Admin upload/save     | Progress bar / button loading      | n/a                                                          | Specific message (too large, wrong type, network); input preserved     |
| Login                 | Button loading                     | n/a                                                          | "Invalid email or password." (generic)                                 |
| Offline               | n/a                                | n/a                                                          | Non-blocking top notice: "You're offline. Some things may not work."   |

---

## 13. Interaction and Motion

### 13.1 Principles

Motion confirms an action or explains a change. It never decorates, never delays content and never moves things unexpectedly. Calm and unhurried suits the brand; nothing bouncy.

### 13.2 Timing and easing

| Token         | Duration | Use                                                           |
|---------------|----------|---------------------------------------------------------------|
| `motion-fast` | 120ms    | Hover, press, color changes                                   |
| `motion-base` | 200ms    | Menu open/close, filter results fade, toasts                  |
| `motion-slow` | 300ms    | Dialog and sheet entrance, image fade-in                      |
| Easing        | —        | Ease-out for entrances, ease-in for exits, standard ease for others |

No animation may exceed 300ms. Nothing loops except the skeleton pulse and the button spinner.

### 13.3 Defined interactions

| Element            | Behavior                                                                                        |
|--------------------|-------------------------------------------------------------------------------------------------|
| Buttons            | Color change on hover and press (`motion-fast`); loading state as in 8.1                        |
| Portfolio card     | Image scale 1.02 and title underline on hover (pointer only); no hover reliance on touch        |
| Filter             | Active state change instantly; grid fades between result sets (`motion-base`); no layout jumping |
| Images             | Fade in once loaded (`motion-slow`)                                                             |
| Mobile menu / dialogs | Fade plus slight upward slide (≤16px), backdrop fades; closing is the reverse              |
| Toasts             | Slide/fade in, auto-dismiss, pause on interaction                                               |
| Form errors        | Appear instantly, no shake animation                                                            |
| Logo               | Static. No animation or hover effects.                                                          |
| Scroll             | Native scrolling only. Anchor scrolling is smooth unless the user prefers reduced motion.       |

### 13.4 Reduced motion

When the user has requested reduced motion: remove slides, scales and smooth scrolling; keep opacity changes under 100ms or none; replace the skeleton pulse with a static state. Content and functionality must be identical.

---

## 14. Responsive Behavior

Design mobile first; enhance upward.

| Aspect          | Mobile (<640)               | Tablet (640–1023)      | Desktop (≥1024)                      |
|-----------------|----------------------------|------------------------|--------------------------------------|
| Navigation      | Menu sheet plus visible CTA button | Menu sheet       | Inline links plus CTA, sticky        |
| Header logo     | Monogram only              | Monogram only          | Horizontal lockup (or monogram + text default) |
| Portfolio grid  | 1 column                   | 2 columns              | 3 columns (4 at ≥1280)               |
| Hero            | Text then image, stacked   | Stacked or side-by-side | Side-by-side                        |
| Services        | Stacked list               | 2 columns              | 3 columns                            |
| Contact         | Intro then form            | Intro then form        | Intro and form side-by-side          |
| Item detail     | Image then text            | Image then text        | Image with side text column          |
| Admin tables    | Stacked cards              | Table, compact         | Full table                           |
| Type scale      | Mobile sizes               | Mobile sizes           | Desktop sizes                        |

**Rules:**

- Support 320px width without horizontal scrolling (except the filter row and wide admin content in their own scroll containers).
- Tap targets ≥44×44px with ≥8px between adjacent targets.
- Honor safe-area insets on notched phones for fixed bars.
- Support portrait and landscape; no orientation lock.
- Text remains usable up to 200% zoom without loss of content or function.
- Test at 320, 375, 768, 1024, 1280 and 1440px widths.

---

## 15. Accessibility Requirements

Target: WCAG 2.1 AA (PRD NFR). These are requirements, not suggestions.

### Structure and semantics

- Use landmarks (`header`, `nav`, `main`, `footer`), one `h1` per page, and logical heading order.
- A "Skip to main content" link is the first focusable element and becomes visible on focus.
- Page title is unique and descriptive. The document language is set to English.
- Lists, tables and buttons use native semantic elements before ARIA.
- The logo image has the accessible name "Aayat Creative Studio" (as a link: "Aayat Creative Studio, home"). Repeated or decorative logo uses have empty alt.

### Keyboard

- Every interactive element is reachable and operable by keyboard in a logical order; no keyboard traps.
- Dialogs, the mobile menu and any image modal trap focus while open, close on Esc and return focus to the triggering element.
- Visible focus ring on all interactive elements: 2px `brown` outline with a 2px `bg` offset gap, ≥3:1 against adjacent colors. Never remove outlines without an equal or better replacement.
- Drag-to-reorder in admin has a keyboard alternative.

### Perceivable

- Contrast per section 4.3. Information is never conveyed by color alone. Gold never carries text or meaning.
- Informative images have meaningful alt text; decorative images use empty alt. Portfolio alt text is required in admin before publishing.
- Form control borders are `line-strong` (≥3:1).
- Text can be resized to 200% and reflows at 320px.
- No content flashes more than three times per second.

### Forms

- Every field has a programmatically associated visible label; helper and error text are linked to the field.
- Errors are announced (`role="alert"` for form-level; field errors linked via `aria-describedby`) and focus moves to the first error on failed submit.
- Required and optional status is communicated in text, not only visually.
- `autocomplete` attributes on name, email and phone fields.

### Dynamic content

- Success and loading changes are announced through live regions (`role="status"`); loading regions set `aria-busy`.
- Filter changes announce the new result count politely.
- Toasts are announced, stay long enough to read (≥5s) and are dismissible.

### Touch and pointer

- Targets ≥44×44px. No functionality depends on hover, multi-finger gestures or precise dragging.

### Testing requirement

Before launch: keyboard-only pass, a screen reader pass (VoiceOver on iOS and one desktop screen reader), automated accessibility scan on Home, Portfolio, Item detail and Contact, a 200% zoom check, and a contrast check of every token pair in section 4.

---

## 16. Design Governance

- **New components:** only add one if no existing component can be composed to meet the need. Document it here first.
- **Raw values:** never use values outside the tokens in sections 4, 5, 6 and 13.
- **Consistency checks before merge:** matches tokens, supports all states (default, hover, focus, active, disabled, loading, error where applicable), works at 320px, passes the accessibility list in section 15.
- **Logo:** only the approved assets from 2.2, used per 2.3. Never recreate the logo in code or fonts.
- **Placeholder content:** during build, placeholder text and images must be clearly marked and replaced before launch (launch checklist item).
- **Change control:** changes to colors, typefaces or principles require owner approval and an update to this document.

---

## 17. Decisions — All Resolved

| # | Decision | Resolution |
|---|----------|------------|
| DD-1 | Logo assets (SVG / transparent PNG variants) | Full lockup **supplied** (`assets/brand/logo-lockup.png`, opaque white bg — `surface` only). Transparent/SVG + monogram variant still needed. ✅ (partial) |
| DD-2 | Item detail as modal vs. own page | Own page `/work/:slug` (resolved in PRD D2) ✅ |
| DD-3 | Portfolio grid image treatment | **A — Masonry** with true aspect ratios. `imageWidth` and `imageHeight` fields added to `portfolio_items` schema. ✅ |
| DD-4 | Official brand hex values and exact typefaces | **Confirmed** from the supplied logo. Sampled tokens (`#4A2512` brown, `#C9A66B` gold, Cormorant Garamond + Jost) are accurate. No changes needed. ✅ |
| DD-5 | Hero imagery (which portfolio pieces) | Owner selects the 1–3 most visually striking pieces before launch. |
| DD-6 | ‘How it works’ steps in Services section | **Included.** Owner will describe process (brief → draft → final). Placeholder copy used until owner supplies exact wording. ✅ |
| DD-7 | Response-time wording on enquiry confirmation | **"We’ll reply soon"** — no time promise. ✅ |
| DD-8 | Photo of owner in About section | **Text only** for now. Photo added later when supplied. ✅ |

---

## 18. Assumptions Summary

1. A single light theme is sufficient; dark mode is not required, so no reversed logo is needed.
2. Brand colors were sampled from the supplied logo image and are close approximations (DD-4).
3. Cormorant Garamond and Jost are acceptable free web-font stand-ins for the logo's lettering (DD-4).
4. A standard outline icon set (Lucide) is acceptable.
5. The primary audience uses phones and arrives from Instagram, so mobile layouts are designed first.
6. The owner supplies portfolio images of consistent quality and enough volume (8–12 minimum) to carry the visual design; the UI is intentionally restrained because the work provides the color.
7. Admin screens share the public design system and are not given a separate visual style.
8. The proposed palette meets AA contrast. It must be re-verified if official brand values replace it.
