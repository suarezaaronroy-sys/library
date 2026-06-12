# aaron-site — standard Jekyll build

Clean rebuild of suarezaaronroy-sys.github.io. One data file drives the
library; layouts/includes replace copy-pasted chrome; notes are real pages.

## Structure

    _config.yml          site meta, plugins, collections — edit once
    _data/grimoires.yml  ← THE library. One entry per grimoire, drives
                           homepage shelf, /projects/, trilogy bands
    _layouts/            default (shell) · page (prose) · note (field notes)
    _includes/           head / header / footer / cta-band / grimoire-card
    _notes/              one .md per note → /notes/<slug>/  (SEO-visible)
    assets/css/main.css  the whole design system, once
    grimoires/           drop your existing 0xx-*.html files here UNCHANGED
                         (no front matter = copied verbatim, Liquid-safe)
    index.html           library-led homepage (static HTML — crawlable)
    projects.html        full library  ·  notes.html  ·  about.html  ·  404

## Run locally

    gem install bundler
    bundle install
    bundle exec jekyll serve        # http://localhost:4000

## Deploy

Push to the `main` branch of <user>.github.io — GitHub Pages builds it
automatically (github-pages gem keeps local + remote versions identical).

## Contact architecture (deliberate)

Two lanes, severable by design:
- Direct (roles, library, collaboration) → suarezaaronroy@gmail.com — site-wide default
- B2B systems engagements → asmultitaskcollective@gmail.com via ASMC
ASMC appears in exactly two places (contact page, about) as a neutral
link — no ownership language anywhere on this site. asmc_url lives in
_config.yml; change once, changes everywhere.

## Migration checklist

1. Copy `favicon.png` into the root.
2. Copy all grimoire HTML files into `/grimoires/` (001–011).
3. Port remaining notes from old notes.html → one .md each in `_notes/`
   (3 are scaffolded; bodies marked MIGRATE need the original text).
4. Port articles if keeping them: add `articles.html` + nav link.
5. Old URLs: /about.html → /about/, /projects.html → /projects/, etc.
   Add redirect stubs at the old paths if you care about inbound links.
6. When the custom domain lands: update `url:` in _config.yml, add CNAME
   file, swap `author.email`.

## Adding content (the whole point)

- **New grimoire:** drop the HTML in /grimoires/, add one YAML entry in
  _data/grimoires.yml. Every page updates.
- **New note:** create _notes/my-slug.md with title/date/category/lede
  front matter. Appears on /notes/ and homepage automatically, with RSS.

Plugins: jekyll-seo-tag (meta/OG), jekyll-sitemap, jekyll-feed (RSS at
/feed.xml) — all GitHub Pages whitelisted.
