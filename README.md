# Aaron Suarez - The Working Library

The source for [suarezaaronroy-sys.github.io/library](https://suarezaaronroy-sys.github.io/library/):
a public portfolio and working reference for operational systems, manuals,
field notes, and essays.

## Current Shape

- Five primary routes: Home, About, Library, Notes, and Contact
- Fifteen published Grimoires (G001-G014 and G017), two visible drafts
  (G015-G016), and one retired alias (G018)
- Seventeen Notes generated from the `_notes` collection
- One data file driving the Library catalogue
- Shared Jekyll layouts and includes for the primary site
- Self-contained HTML for the long-form Grimoires

## Structure

```text
_config.yml          Site metadata, plugins, collections, feeds, and defaults
_data/grimoires.yml  Catalogue data and publication state
_includes/           Shared head, header, footer, CTA, and catalogue card
_layouts/            Shared shell, page, and Note layouts
_notes/              Markdown Notes published at /notes/<slug>/
assets/               Site CSS, JavaScript, images, and social preview artwork
grimoires/            Self-contained G001-G018 HTML documents
index.html            Home
about.html            About
projects.html         Library catalogue
notes.html            Notes index
contact.html          Contact routing
404.html              Custom non-indexable 404 page
```

## Run Locally

```powershell
bundle install
bundle exec jekyll serve
```

The default local URL is `http://127.0.0.1:4000/library/`.

## Deploy

GitHub Pages builds this project site from the `main` branch of the
`library` repository. The production base path is `/library`; keep `url` and
`baseurl` in `_config.yml` aligned with that deployment.

## Publishing Content

### Add a Grimoire

1. Add the self-contained HTML file under `grimoires/`.
2. Add or update its entry in `_data/grimoires.yml`.
3. Include one `h1`, a description, canonical URL, Open Graph image, Twitter
   card, and valid JSON-LD.
4. Keep drafts `noindex` and out of the sitemap with front matter:

```yaml
---
layout: null
sitemap: false
---
```

`layout: null` is required so Jekyll does not wrap a standalone Grimoire in
the shared site layout.

### Add a Note

Create `_notes/<slug>.md` with `title`, `date`, `category`, `lede`, and
`description` front matter. Notes appear on the Notes index and in
`/feed.xml`.

## Discovery Layer

- `jekyll-seo-tag` generates metadata for shared-layout pages.
- `jekyll-sitemap` generates `/sitemap.xml`.
- `jekyll-feed` publishes all Notes at `/feed.xml`.
- `jekyll-redirect-from` preserves the legacy `.html` primary routes.
- `robots.txt` allows crawling and advertises the sitemap.
- `assets/og-default.png` is the 1200 x 630 fallback social image.
- `tools/generate-og-previews.ps1` generates page-specific 1200 x 630 cards
  for Site, Workbench, Lab, Grimoires, and Notes, then wires `image:` front
  matter or standalone Open Graph/Twitter tags. Run it after adding public
  pages:

```powershell
powershell -ExecutionPolicy Bypass -File tools\generate-og-previews.ps1
```

## Contact Architecture

Direct roles, collaboration, writing, and library questions use
`suarezaaronroy@gmail.com`. Selective build-and-handoff systems work is
referred to the separate ASMC studio at `asmultitaskcollective@gmail.com`.
Both destinations are configured in `_config.yml`.
