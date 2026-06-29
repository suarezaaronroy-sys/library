# Grimoires

This directory contains the Working Library's self-contained long-form HTML
documents, currently numbered G001 through G018.

Published Grimoires must include:

- one semantic `h1`
- one meta description
- one canonical URL
- Open Graph title, description, URL, and image
- a `summary_large_image` Twitter card
- valid JSON-LD where structured data is used

Drafts and retired aliases remain directly accessible but must use
`noindex` and be excluded from the sitemap. Add this front matter without
changing the standalone document:

```yaml
---
layout: null
sitemap: false
---
```

The Library catalogue is driven separately by `_data/grimoires.yml`; adding
an HTML file here does not add its card automatically.
