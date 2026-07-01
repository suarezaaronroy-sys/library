# Live Site QA Handoff

Audit date: 2026-07-02 (Asia/Taipei)  
Live site: https://suarezaaronroy-sys.github.io/library/  
Audited deployment: commit `8adbc0a`  
Purpose: parking document for the next human or LLM continuing site QA.

## Read This First

The site is live and fundamentally healthy. No P0 outage, data-loss, malware,
credential, broken-deployment, or indexing emergency was found.

The next session should begin with the two P1 findings below. Do not start with
metadata polishing while G002 and G006 still overflow on mobile.

## Audit Scope

- Crawled all 41 URLs in the live sitemap.
- Directly checked draft Grimoires G015 and G016.
- Checked all internal links and internal assets.
- Checked desktop rendering at the normal browser viewport.
- Checked mobile rendering at 390 x 844.
- Checked page titles, descriptions, canonicals, robots directives, H1 counts,
  Open Graph, Twitter cards, JSON-LD, image alt attributes, and duplicate IDs.
- Checked Google Analytics coverage and third-party script hosts.
- Checked the browser console while navigating all 41 indexed pages.
- Exercised universal search with a real query.
- Re-tested the Whiteboard template, dry-run, and presentation deployment in
  the preceding release QA.
- Ran mobile Lighthouse samples against Home and G006.
- Re-tested the external QA report supplied by the site owner.

## Priority Definitions

- P0: site unavailable, destructive, compromised, or broadly unusable.
- P1: major user-facing failure on an important route; fix first.
- P2: material quality, accessibility, security, privacy, or SEO issue.
- P3: polish, consistency, semantics, or future-hardening work.

## P0 - Critical

None found.

All 41 sitemap URLs returned `200`. G015 and G016 also returned `200` and
correctly remain `noindex, nofollow`.

## P1 - Fix First

### P1.1 - G002 and G006 overflow badly on mobile

Affected pages:

- https://suarezaaronroy-sys.github.io/library/grimoires/002-dual-wing-rental.html
- https://suarezaaronroy-sys.github.io/library/grimoires/006-automations-101.html

Reproduction:

1. Open either URL at a 390px viewport.
2. The document becomes wider than the screen.
3. G002 reaches 686px document width.
4. G006 reaches 900px document width.
5. Headings, controls, cards, and paragraphs are clipped; a horizontal
   scrollbar appears.

Likely causes:

- `grimoires/002-dual-wing-rental.html:191` defines `.main` without
  `min-width: 0`, `width: 100%`, or border-box sizing.
- Its mobile rule at line 754 changes the grid but does not constrain `.main`.
- The walkthrough and `.reader-paths` remain desktop-width at mobile sizes.
- `grimoires/006-automations-101.html:51` defines `.main` with
  `max-width: 900px` but no `min-width: 0` or explicit mobile width.
- Its collapsed grid still honors the grid item's intrinsic minimum width.

Suggested first patch:

```css
.main {
  box-sizing: border-box;
  min-width: 0;
  width: 100%;
  max-width: 900px;
}

@media (max-width: 768px) {
  .walkthrough,
  .hero,
  .showcase,
  .diagram-wrap {
    min-width: 0;
    max-width: 100%;
  }

  .reader-paths {
    grid-template-columns: 1fr;
  }
}
```

Verify after patch at 320, 375, 390, 768, and 1280px. The acceptance condition
is `document.documentElement.scrollWidth <= window.innerWidth`.

### P1.2 - G006 is extremely slow on a mobile profile

URL:

https://suarezaaronroy-sys.github.io/library/grimoires/006-automations-101.html

Measured Lighthouse sample:

- Performance: 27
- Accessibility: 96
- Best Practices: 100
- SEO: 100
- First Contentful Paint: 5.1s
- Largest Contentful Paint: 9.4s
- Total Blocking Time: 5,960ms
- Time to Interactive: 12.2s
- HTML payload: 611KB
- DOM elements: 17,633
- Main-thread work: 13.9s

Largest contributor:

- Mermaid evaluates for roughly 7.5s.
- The page contains roughly 35 Mermaid blocks and initializes them all with
  `startOnLoad: true` at `grimoires/006-automations-101.html:8802`.

Recommended sequence:

1. Set Mermaid `startOnLoad: false`.
2. Render diagrams only when they approach the viewport, or add an explicit
   "Render diagram" control.
3. Use `content-visibility: auto` and a sensible intrinsic size on distant
   chapter sections.
4. Consider splitting the 51,000-word manual into chapter documents only if
   lazy rendering is not enough.
5. Re-run Lighthouse after each change; do not combine this with a visual
   redesign.

### P1.3 - Home is visually strong but slow on a mobile profile

URL:

https://suarezaaronroy-sys.github.io/library/

Measured Lighthouse sample:

- Performance: 52
- Accessibility: 95
- Best Practices: 100
- SEO: 100
- First Contentful Paint: 4.6s
- Largest Contentful Paint: 14.2s
- Total Blocking Time: 410ms
- Cumulative Layout Shift: 0
- Total transfer: approximately 2.3MB

The LCP is the hero workflow image. Lighthouse also estimated approximately
1.8MB in image savings across the page.

Recommended sequence:

1. Convert brand photography to WebP or AVIF.
2. Generate responsive sizes rather than serving 2000px images into small
   cards.
3. Add `fetchpriority="high"` to the Home hero image.
4. Add `loading="lazy"` to below-the-fold Home images.
5. Add width and height attributes to reserve image space.

Relevant files:

- `index.html:7`
- `index.html:82`
- `assets/css/main.css:100`
- `assets/img/brand/`

## P2 - Material Follow-Up

### P2.1 - G014 has smaller but real mobile overflow

URL:

https://suarezaaronroy-sys.github.io/library/grimoires/014-remote-work-101.html

At 390px, the page reaches 407px. The primary causes are:

- `.c0-choice` uses a non-wrapping horizontal flex layout.
- `.c0-choice-dest` has `flex-shrink: 0`.
- Several tables exceed their `.table-wrap` containers.

Relevant lines:

- `grimoires/014-remote-work-101.html:180`
- `grimoires/014-remote-work-101.html:183`

Suggested mobile behavior:

```css
@media (max-width: 640px) {
  .c0-choice {
    align-items: flex-start;
    flex-direction: column;
  }

  .c0-choice-dest {
    max-width: 100%;
    overflow-wrap: anywhere;
    white-space: normal;
  }

  .table-wrap {
    max-width: 100%;
  }
}
```

### P2.2 - Systemic color contrast misses

Representative Lighthouse results:

- Home: 29 contrast failures.
- G006: 682 contrast failures.

Home examples:

- Header nav uses `#78716c` on `#ede9e0`, approximately 3.95:1.
- Small proof text uses `#a8a29e` on `#f5f2ec`, approximately 2.25:1.

G006 repeats muted text at insufficient contrast throughout the very large
document. Fixing shared color tokens should resolve many instances at once.

Do not fix this by increasing every font size independently. Prefer stronger
foreground tokens for small text and muted text on dark cards.

### P2.3 - Four Grimoires have unsafe new-tab links

There are 31 links using `target="_blank"` without `rel="noopener"`:

- G005: 7
- G007: 9
- G008: 7
- G009: 8

This creates a reverse-tabnabbing risk in older or unusual browser contexts.
Add at least `rel="noopener"`; use `rel="noopener noreferrer"` if referrer
suppression is also desired.

### P2.4 - Tracking is inconsistent and not explained site-wide

Observed behavior:

- Google Analytics measurement ID `G-GYPEWZXH03` appears on 40 of 41 indexed
  pages.
- G017 is the only indexed page without the Analytics tag.
- No unrelated third-party tracker, iframe, ad pixel, or form processor was
  found.
- The only external script host across the normal site is Google Tag Manager;
  G006 also loads Mermaid from jsDelivr.
- There is no site-wide privacy or analytics notice.

Decision needed:

1. If G017 should participate in reporting, add the shared Analytics tag.
2. If G017 is intentionally tracker-free, document the exception.
3. Add a short privacy page explaining Analytics and the local-first
   Workbench.
4. Determine consent requirements based on the actual visitor jurisdictions;
   this audit does not make a legal determination.

### P2.5 - Search snippets are frequently longer than common display ranges

This is not an indexing failure and does not directly cause a ranking penalty.
Search engines may truncate or rewrite these snippets.

Titles over 60 characters: 16 pages.

- G014: 84
- Stop Training People note: 79
- About: 77
- Landlord List note: 74
- Automation Trap note: 71
- Why I Published GHL note: 70
- G012: 68
- Escalation Tax note: 67
- CRM Operating System note: 67
- G002 and G003: 66
- G006 and Documentation Noise note: 65
- Local SEO note: 63
- G004 and G017: 61

Descriptions over 160 characters: 15 pages.

- Projects: 201
- G006: 199
- G003: 196
- G005: 192
- G013: 191
- G001: 188
- G004 and G009: 186
- Home: 185
- G011: 179
- G012: 176
- G002 and G008: 172
- G010: 169
- G014: 166

Treat this as a deliberate editorial pass, not a bulk character-chopping job.
Keep titles descriptive and unique.

### P2.6 - Accessibility semantics have a few representative failures

- Home brand link's visible text is not included in its accessible name.
- One large decision matrix in G006 has row-label cells implemented as `td`
  rather than row headers.
- G001 is the only indexed page without a semantic `main` landmark.

Suggested fixes:

- Make the brand link accessible name include "Aaron Suarez".
- Use `<th scope="row">` for G006 matrix row labels.
- Wrap G001's document content in `<main>`.

## P3 - Polish and Hardening

### P3.1 - Every indexed page uses the same social image

All 41 indexed pages use:

`/library/assets/og-default.png`

The tag is valid and the image returns `200`, so sharing is not broken. The
site is leaving visual differentiation on the table. Prioritize custom OG
images for Home, About, Projects, G006, G009-G011, G014, and G017.

### P3.2 - Most shared-site images omit dimensions and lazy loading

The shared logo and content images generally omit width/height. Below-the-fold
images are not lazy-loaded. This contributes to unnecessary transfer and can
make future layout shifts more likely, although the sampled Home CLS was 0.

### P3.3 - Security headers are minimal

Observed response headers:

- HSTS is present.
- CSP is absent.
- `X-Content-Type-Options` is absent.
- `X-Frame-Options` is absent.
- Referrer Policy is absent.
- Permissions Policy is absent.

GitHub Pages limits server-header control, and this is a static site with no
account or backend, so this is not an emergency. Consider a CSP meta tag and a
Referrer Policy meta tag only after testing every Grimoire's inline scripts,
fonts, Analytics, Mermaid, and Workbench behavior.

### P3.4 - `/library/about` serves a redirect document

This is not a redirect loop.

- `/library/about` returns a small `200` noindex redirect document.
- That document points once to `/library/about/`.
- `/library/about/` returns the full About page.
- All current site navigation uses `/library/about/`.

The redirect document exists because the Jekyll redirect alias generates
`about.html`, and GitHub Pages resolves the extensionless path to that file.
It can confuse simplistic fetch-only QA tools but does not block normal
browsers.

Possible cleanup:

- Remove the `/about.html` redirect alias only after confirming no meaningful
  external links still use it.
- Otherwise leave it and document the expected behavior.

## Externally Reported Findings - Re-Tested

The owner supplied the following outside QA summary:

> Found something already - let me follow that redirect and check what's
> actually happening. Good, homepage loads clean this time and gives me a full
> site map to work with. Let me check the other main sections. Good, that's
> clean. Let me spot-check a grimoire page and confirm the About redirect bug is
> really stuck. Confirmed - that's a real, reproducible bug, not a fluke. Now
> let's check a grimoire page and Workbench for content-level QA. Ran a real
> crawl across About, homepage, Library, Notes, Contact, a grimoire page, and
> the Workbench. Found one real bug and a couple of consistency issues.
>
> Critical: `/about/` is stuck in a redirect loop.
>
> Numbers don't match between homepage and Library.
>
> Workbench is missing from the subpage nav.

Disposition after direct live re-test:

| Reported claim | Result | Evidence |
|---|---|---|
| `/about/` redirect loop | Not reproduced | Slash URL returns the full page. Extensionless URL redirects once via a static document. |
| Home says 15 while Library says 14 | Stale | Projects metadata says 15 live and the page links 15 unique live Grimoires, including G017. |
| Workbench missing on Projects, Notes, Contact | Stale | All three live pages include `/library/workbench/` in the shared nav. |
| Main pages load with consistent branding | Confirmed | Desktop and mobile checks passed outside the three overflow Grimoires. |
| 11 field notes | Confirmed | Notes and Home counts agree. |
| Metadata present | Confirmed | All 41 indexed pages have valid titles, descriptions, canonicals, OG tags, Twitter cards, and parseable JSON-LD. |

Do not create fixes for the three stale claims unless they reproduce again with
the exact URL, response body, browser, and timestamp recorded.

## Confirmed Healthy

- 41/41 indexed URLs return `200`.
- All internal linked targets checked successfully.
- All internal assets checked successfully.
- No broken images were found.
- No document-level desktop overflow was found.
- 38/41 indexed pages have no mobile document overflow.
- No duplicate titles, descriptions, or canonicals were found.
- Every indexed page has exactly one H1.
- Every indexed page has a canonical URL.
- Every indexed page has a description.
- Every indexed page has Open Graph and Twitter metadata.
- All JSON-LD blocks parse successfully.
- No duplicate IDs were found.
- No mixed-content URLs were found.
- All image elements have alt attributes.
- G015 and G016 are excluded from the sitemap and use `noindex, nofollow`.
- Universal search opens, filters correctly, shows breadcrumbs, and closes.
- Query `invoice` returned Billing Workspace, PayPal, Wise, and Xero.
- All Workbench routes returned `200`.
- Whiteboard deployment exposes all eight starter families.
- Browser console recorded no warning or error while traversing the site.

## Recommended Next Session

Use a fix-check-fix-check loop:

1. Fix G006 mobile width.
2. Re-check G006 at 320, 375, 390, 768, and desktop.
3. Change Mermaid to lazy/on-demand rendering.
4. Re-run G006 Lighthouse.
5. Fix G002 mobile width and walkthrough stacking.
6. Re-check G002 at the same viewports.
7. Fix G014's small overflow.
8. Optimize Home images and re-run Home Lighthouse.
9. Fix contrast tokens and new-tab links.
10. Decide Analytics/privacy policy.
11. Perform metadata and OG-image polish last.

## Parking State

- No code fixes were made during this audit.
- This file is the only intended repository change from the audit.
- Temporary Lighthouse files were written outside the repository.
- The browser viewport was reset after responsive testing.
- The live browser was returned to `/library/workbench/`.

