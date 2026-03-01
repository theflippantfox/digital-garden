# Dynamic Notes via API — No Rebuild Required

> **tl;dr**: Yes, you can serve notes dynamically through an API so the site never needs to rebuild when you update notes. Here's exactly how.

---

## The Core Problem

The current setup is a **static site**: all notes are compiled into HTML at build time. This means every note update requires a full rebuild (~2 min). For frequent writers, that's annoying.

The alternative is to **separate the data layer from the presentation layer**: the SvelteKit site stays deployed as a static shell, but it fetches notes from an API at runtime. You update notes → API returns new data → site shows it instantly, no rebuild.

---

## Architecture Comparison

```
CURRENT (Static Build)
───────────────────────────────────────────────────────────────────
Notes (.md) ──build──► SvelteKit compiles ──► Static HTML/CSS/JS
                         (reads notes)             deployed once

                         Update notes → must rebuild → redeploy


API MODE (Dynamic)
───────────────────────────────────────────────────────────────────
Notes (.md) ──push──► API server reads .md ──► JSON response
                         (always live)
                               ↑
                       SvelteKit fetches at runtime
                       (static shell, dynamic data)

                       Update notes → push → API returns new data → done ✓
```

---

## Option A: GitHub as Your API (Free, Zero Infrastructure)

The simplest approach: use the **GitHub Contents API** to read your markdown files directly from your private repo. No server needed.

### How it works

GitHub has a built-in REST API that returns file contents. You call it with your PAT, it returns base64-encoded markdown, you parse it in the browser.

```
GET https://api.github.com/repos/your-username/my-notes/contents/
Authorization: token YOUR_PAT
```

Returns a list of files. Then for each file:

```
GET https://api.github.com/repos/your-username/my-notes/contents/my-note.md
Authorization: token YOUR_PAT
```

Returns the file with content base64-encoded.

### Implementation

Replace `src/routes/+page.server.ts` with a client-side load instead:

**`src/routes/+page.ts`** (note: `.ts` not `.server.ts`):

```typescript
import { parseNote } from '$lib/notes-client';

const REPO    = 'your-username/my-notes';
const TOKEN   = import.meta.env.VITE_GITHUB_TOKEN; // set in .env

export const ssr = false; // client-side only

export async function load({ fetch }) {
  // List all markdown files
  const listRes = await fetch(
    `https://api.github.com/repos/${REPO}/contents/`,
    { headers: { Authorization: `token ${TOKEN}`, Accept: 'application/vnd.github.v3+json' } }
  );

  const files: Array<{ name: string; download_url: string }> = await listRes.json();
  const mdFiles = files.filter(f => f.name.endsWith('.md'));

  // Fetch all notes in parallel
  const notes = await Promise.all(
    mdFiles.map(async file => {
      const res  = await fetch(file.download_url);
      const text = await res.text();
      return parseNote(file.name, text);
    })
  );

  return { notes: notes.filter(n => n.published) };
}
```

**`.env`** (never commit this):
```
VITE_GITHUB_TOKEN=ghp_your_token_here
```

### Trade-offs of the GitHub API approach

| Pros | Cons |
|---|---|
| Zero infrastructure cost | Token exposed in client bundle (mitigate with a proxy) |
| No server to maintain | Rate-limited to 5,000 req/hour (fine for personal use) |
| Always reads latest notes | ~100–300ms latency per page load |
| Works with private repos | Requires CORS-friendly API (GitHub ✓) |

### Securing the token

The `VITE_` prefix exposes the token in the browser bundle. For a private garden you probably don't mind, but if you want it hidden, add a thin proxy:

```typescript
// src/routes/api/notes/+server.ts  (runs server-side)
import { GITHUB_TOKEN } from '$env/static/private'; // never exposed to client

export async function GET() {
  const res = await fetch('https://api.github.com/repos/your-username/my-notes/contents/', {
    headers: { Authorization: `token ${GITHUB_TOKEN}` }
  });
  const data = await res.json();
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  });
}
```

Then your page fetches `/api/notes` instead of GitHub directly.

> **Note**: This requires deploying to a platform that runs Node.js (Vercel, Fly.io, Railway) instead of GitHub Pages, because GitHub Pages can only serve static files.

---

## Option B: Dedicated API Server (Most Flexible)

Build a small API server that watches your notes directory and serves them as JSON. This is the right choice if you want full control.

### Tech: Node.js + Express (or Hono)

```typescript
// server/index.ts
import express from 'express';
import { loadAllNotes } from './notes';  // reuse your existing parser

const app  = express();
const PORT = process.env.PORT ?? 3001;

// Cache notes in memory, re-read on demand or on a timer
let cache: Note[] | null = null;
let cacheTime = 0;
const TTL = 60_000; // re-read files every 60 seconds

app.get('/api/notes', (req, res) => {
  const now = Date.now();
  if (!cache || now - cacheTime > TTL) {
    cache     = loadAllNotes();
    cacheTime = now;
  }
  res.json(cache.map(({ html: _, ...summary }) => summary));
});

app.get('/api/notes/:slug', (req, res) => {
  const note = loadAllNotes().find(n => n.slug === req.params.slug);
  if (!note) return res.status(404).json({ error: 'Not found' });
  res.json(note);
});

// Invalidation webhook — call this from your notes repo dispatch
app.post('/api/invalidate', (req, res) => {
  cache = null;
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Notes API on :${PORT}`));
```

### Deploying the API

**Fly.io** (easiest, free tier available):
```bash
fly launch          # creates fly.toml
fly deploy          # deploys to a global edge
```

**Railway** (even simpler):
```bash
# Connect your GitHub repo, Railway detects Node.js and deploys automatically
```

**Your own VPS** (Hetzner CX11 = ~€4/month):
```bash
# Install Node, clone repo, run with PM2
pm2 start server/index.js --name garden-api
```

### SvelteKit fetches from the API

```typescript
// src/routes/+page.ts
export const prerender = false; // dynamic

export async function load({ fetch }) {
  const res   = await fetch('https://api.yourdomain.com/api/notes');
  const notes = await res.json();
  return { notes };
}
```

---

## Option C: Cloudflare Workers + R2 (Serverless, Fast)

Push your compiled notes as JSON to **Cloudflare R2** (object storage), then a **Worker** serves them globally with <10ms latency. No server to maintain.

### The flow

```
git push notes ──► GitHub Action ──► parses .md ──► uploads notes.json to R2
                                                              │
                SvelteKit page ──────────────────────────────► Worker serves notes.json
```

### GitHub Action to compile + upload

```yaml
# In your private notes repo
- name: Compile notes to JSON
  run: node scripts/compile.mjs   # your notes.ts parser, but CLI-friendly

- name: Upload to R2
  uses: ryand56/r2-upload-action@latest
  with:
    r2-account-id: ${{ secrets.CF_ACCOUNT_ID }}
    r2-access-key-id: ${{ secrets.CF_ACCESS_KEY_ID }}
    r2-secret-access-key: ${{ secrets.CF_SECRET_ACCESS_KEY }}
    r2-bucket: my-notes-bucket
    source-dir: ./compiled
    destination-dir: /
```

### Worker

```typescript
// workers/notes.ts
export default {
  async fetch(req: Request, env: Env) {
    const url = new URL(req.url);

    if (url.pathname === '/api/notes') {
      const obj = await env.NOTES_BUCKET.get('notes.json');
      if (!obj) return new Response('Not found', { status: 404 });
      return new Response(obj.body, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }
    return new Response('Not found', { status: 404 });
  }
};
```

### Trade-offs

| | GitHub API | Express Server | Cloudflare Workers |
|---|---|---|---|
| Cost | Free | ~€4/mo VPS | Free–$5/mo |
| Latency | ~100ms | Depends on server location | <10ms globally |
| Setup complexity | Low | Medium | Medium |
| Real-time updates | Yes (read on demand) | Yes (with TTL cache) | ~1 min (after upload) |
| Token security | Needs proxy for full security | Secure (server-side) | Secure (env vars) |

---

## My Recommendation

| Your situation | Best option |
|---|---|
| Just want it to work, notes update rarely | **Keep the static build** (it's simple and free) |
| Update notes daily, want instant deploys | **Option A: GitHub API** (15 min to set up) |
| Notes are private and you want full control | **Option B: Express on Railway** |
| Want it fast everywhere globally | **Option C: Cloudflare Workers** |

For most personal gardens, the **auto-rebuild on push** (covered in PUBLISHING.md Step 6) is the right answer — it takes 2 minutes and you never think about it again. The API approach is worth it once you're updating notes multiple times a day and the rebuild latency bothers you.

---

## Hybrid Approach: Static Shell + API Content

The cleanest architecture long-term is a **hybrid**: deploy the SvelteKit UI as a static shell to GitHub Pages (free, fast CDN), but fetch notes from your API at runtime.

```
GitHub Pages          API (Railway / Fly.io)
───────────────        ──────────────────────
HTML shell       ←──── GET /api/notes
CSS/JS assets    ←──── GET /api/notes/:slug
(static, cached)       (dynamic, always fresh)
```

This gives you:
- Free hosting for the shell (GitHub Pages)
- No rebuild needed for content updates
- Private notes never in a public repo
- Fast initial load (static shell preloads instantly)

The main cost is running a small API server (~€4/month on the cheapest VPS or free tier on Railway/Render).
