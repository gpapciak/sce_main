# Second Chance — Foundational Courses (site shell)

The learner-facing hub for the Second Chance self-paced courses. Plain static
site: **vanilla HTML, CSS, and JavaScript — no build step, no framework, no
backend.** It deploys by copying files.

- **Phone-first**, anonymous by design (no accounts, no PII), low-friction,
  light, and accessible (WCAG AA).
- Hosts SCORM course packages served from **sibling repos on the same origin**.
  The SCORM launch wrapper is **built** (`scorm-again`, vendored) — see below.
- Live data capture (Supabase) is **Phase 2** — intake and completion write to
  `localStorage` now, with commented hooks where the anonymous Supabase writes
  go later.

## Repos & how course media is split

Everything is sibling repos under the **same GitHub account → same origin**, so
SCORM messaging and shared progress work across them. On Pages they serve at
`…github.io/sce_main/`, `…github.io/sce_courses_en1/`, etc.

| Repo | Holds |
|------|-------|
| `sce_main` | this hub (HTML/CSS/JS, i18n, catalog, logo) |
| `sce_courses_en1` | English media: **welcome**, **personal-growth** |
| `sce_courses_en2` | English media: **gender**, **leadership** |
| `sce_courses_es1/es2`, `fr1/fr2`, `ar1/ar2` | future per-language media (empty now) |

Group **1** = welcome + personal-growth; group **2** = gender + leadership. The
launcher resolves a lesson's repo as `sce_courses_{contentLang}{group}` and
loads it **sibling-relative**: `../sce_courses_en1/<course>/<lesson>/<launchfile>`
(no absolute `/` paths, no hardcoded domains). There are **no** `hi1/hi2` repos —
Hindi uses the English modules (see Languages).

## Run it locally

You must use a **local web server** — do **not** open files via `file://`
(relative `fetch()` for i18n/catalog **and** the SCORM iframe handshake both
need a real origin; `file://` produces phantom bugs).

Because launch paths now traverse up into sibling repos
(`../sce_courses_en1/…`), **root the server at the PARENT folder** that contains
`sce_main`, `sce_courses_en1`, and `sce_courses_en2` as siblings — not inside
`sce_main` — then browse into `/sce_main/`:

```bash
cd <parent folder containing sce_main + sce_courses_en1 + sce_courses_en2>
python -m http.server 8000          # or: npx serve .
# open http://localhost:8000/sce_main/
```

This also matches production, where the project site serves from the
**subpath** `https://<user>.github.io/sce_main/`. (Opening `sce_main` at the
root instead would break the `../sce_courses_*` lookups.)

### Diagnostic SCORM fixture

A known-good SCORM 1.2 package lives at `_fixtures/scorm12-sample/` (kept **out**
of the catalog). Verify the wrapper independently of real content at
`http://localhost:8000/sce_main/launch.html?fixture=1` (append `&auto=1` to
self-complete).

## Project layout

```
index.html          Landing: language selection + entry to courses
courses.html        Course index (tiles), language-aware, with progress
course.html         Single course: its modules + progress + completion CTA
launch.html         SCORM module launcher (scorm-again wrapper — built)
intake.html         Optional anonymous intake (front-end, local-only now)
complete.html       Completion + client-side certificate (local-only now)
help/               how-to, tips, faq, contact
css/styles.css      Single stylesheet — design system, light theme, RTL-safe
js/i18n.js          Loads i18n/<lang>.json, swaps strings, sets lang/dir
js/progress.js      localStorage progress/completion model (anonymous token)
js/components.js    Injects shared header/footer/nav (relative paths)
js/courses.js       Catalog + tile/lesson rendering
js/intake.js        Intake form + shared form helpers (country picker)
js/vendor/          scorm-again (MIT), vendored; loaded only by launch.html
i18n/*.json         Per-language strings (en live; es/fr/hi/ar are TODO stubs)
data/catalog.json   Course/lesson catalog (real lessons + repo mapping)
tools/gen-catalog.js  Dev helper: regenerate catalog from the manifests
_fixtures/          Diagnostic SCORM fixture (not in the catalog)
netlify.toml        Empty build command, publish "."
.nojekyll           Disable Jekyll processing on GitHub Pages
```

## How it's wired

- **No hardcoded UI text.** Every visible string is a key resolved at runtime
  from `i18n/<lang>.json` via `data-i18n` / `data-i18n-attr` / `data-i18n-html`.
  Untranslated values (`TODO …`) fall back to English so nothing ever looks
  broken. (Lesson *titles* are content, read from each package manifest into
  `catalog.json`, not from i18n.)
- **Subpath-safe paths.** `js/i18n.js` and `js/components.js` resolve the site
  root from their own `<script src>` URL, so every link/asset works at root or
  at a `/sce_main/` subpath. Use `SCE_I18N.url('path')` for any runtime URL.
- **RTL groundwork.** The CSS uses logical properties (`margin-inline-*`,
  `text-align: start`, …). Arabic sets `dir="rtl"` on `<html>` and the layout
  mirrors with no rework. (Arabic content isn't live yet.)
- **Anonymous progress.** `js/progress.js` stores a version-tagged JSON object
  in `localStorage` (`sce_progress_v1`) under a random opaque token (UUID v4)
  that identifies nobody. All access is wrapped: missing/old/corrupt data
  degrades to a clean "not started" state and never throws.
- **Privacy.** No accounts, no PII, no analytics/trackers/cookies. The
  certificate name is rendered in-browser only and is never stored or sent.
  The only reliable data layer is the anonymous completion metric
  (token + country + course + date).

## Fonts

**Decision (confirmed): English launch uses the system-font-first stack — no
Google Fonts, no self-hosted font.** This makes **zero external requests**
(no IP leak to any third party), paints instantly on mobile data, and renders
fine on modest phones — the right call for §10/§12 and this audience.

When **Hindi and Arabic** content lands, those scripts genuinely need Noto's
coverage, so we'll **self-host subsetted Noto woff2 files from our own origin**
(still no third-party call): drop e.g. `NotoSansDevanagari-subset.woff2` /
`NotoSansArabic-subset.woff2` into `assets/fonts/` and uncomment the matching
`@font-face` block at the top of `css/styles.css`. They're keyed off the
`lang`/`dir` already on `<html>`. English stays on the system stack.

Google Fonts is intentionally **not** used (it would send every learner's IP to
Google on each page load).

## Languages

Five **interface** languages: English, Spanish, French, Hindi, Arabic. Three
states, set by `live` in `js/i18n.js` and `contentLang` in `data/catalog.json`:

- **English** — fully live (interface + English course media).
- **Hindi** — live **interface** language; its courses load the **English
  modules** (`contentLang.hi = "en"` → repos `sce_courses_en1/en2`; there are no
  `hi1/hi2`). The launcher shows a permanent note, *"The course modules are in
  English."* Interface text becomes Hindi the moment `i18n/hi.json` is
  translated; until then it falls back to English per-key. This is **by
  design**, not a stopgap.
- **Spanish / French / Arabic** — **"coming soon"** (the landing shows a
  friendly notice + "continue in English") until *both* their interface strings
  *and* their course media (`sce_courses_xx1/xx2`) are placed.

Arabic keeps its RTL groundwork (`dir="rtl"`, logical-property CSS) and the
Noto Sans Devanagari/Arabic `@font-face` hooks stay staged in `css/styles.css`.

## Adding / updating course media

1. Put each lesson's SCORM package in the matching sibling repo and group:
   **group 1** (`sce_courses_<lang>1`) = welcome + personal-growth; **group 2**
   (`sce_courses_<lang>2`) = gender + leadership. Layout:
   `sce_courses_en1/<course>/<lesson>/` (heavy media stays out of `sce_main`).
2. Regenerate the catalog from the manifests (reads titles + paths, no build
   step — run manually, commit the result):
   ```bash
   cd sce_main && node tools/gen-catalog.js
   ```
   The launcher reads each package's `imsmanifest.xml` at runtime for the real
   launch file + SCORM version (it never assumes `index.html`).
3. For a **new language's** media, add its repos `sce_courses_xx1/xx2`, flip
   `live:true` for `xx` in `js/i18n.js`, translate `i18n/xx.json`, and (if the
   media is genuinely in that language) keep `contentLang.xx = "xx"`.

The wrapper itself (`launch.html`) hosts **`scorm-again`** (MIT, vendored at
`js/vendor/scorm-again.min.js`) as `window.API` (SCORM 1.2) /
`window.API_1484_11` (2004) before the iframe loads, enforces same-origin, and
calls `SCE_PROGRESS.setLessonStatus(course, lesson, 'completed')` on
completed/passed.

> File paths are **case-sensitive** on the host (`Logo.png` ≠ `logo.png`). Keep
> references exactly consistent with filenames.

## Phasing

- **Shell + Step 2:** done — full shell, and the `scorm-again` wrapper wiring
  the real English packages from `sce_courses_en1/en2`.
- **Phase 2:** Supabase (EU region) — replace the commented hooks in
  `js/intake.js` and `js/progress.js` with anonymous writes; reporting export.
- **Phase 3 (optional):** PWA/offline; within-lesson resume via `suspend_data`;
  Hindi interface translation; Spanish/French/Arabic interface + media.
