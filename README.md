# Feishu Astro Personal Site

This is the target GitHub Pages site template for Feishu Blog Publisher.

## What It Provides

- Astro static site.
- Blog, story, now, tags, about pages.
- RSS and sitemap.
- Lightweight JSON search index at `/search/index.json`.
- YAML site configuration under `content-config/`.
- GitHub Actions workflow for publishing Feishu documents.

## Commands

```bash
npm install
npm run publish:mock
npm run build
npm run dev
```

## Content Flow

```text
Feishu document
  -> scripts/publish-feishu.mjs
  -> src/content/{blog|story|now}/{slug}.md
  -> public/images/{blog|story|now}/{slug}/

Public article URLs use `/posts/{slug}/`; `blog` remains the internal content collection name.
  -> astro build
  -> GitHub Pages
```

## GitHub Actions Secrets

Set these in the target website repository:

```text
FEISHU_APP_ID
FEISHU_APP_SECRET
```

The Chrome extension triggers `.github/workflows/publish-feishu.yml` through `workflow_dispatch`.
