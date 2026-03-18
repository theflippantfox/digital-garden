# Digital Garden

A SvelteKit + TypeScript + Tailwind digital garden. Notes live in a **private** repo; only the compiled static site is public.

## Quick Start

```bash
npm install
ln -s ~/path/to/your/obsidian-vault notes   # or just drop .md files in notes/
npm run dev   # → http://localhost:5173
```

## Note Format

```yaml
---
title: My Note
date: 2026-02-22
tags: [first-tag, second-tag]   # first tag = primary colour/emoji
status: seedling                 # seedling | budding | evergreen | compost
published: true                  # false to hide
---

Note content. Use [[Wikilinks]] to link notes.
```
