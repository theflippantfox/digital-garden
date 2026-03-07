/**
 * Digital Garden API — Cloudflare Worker
 *
 * Routes:
 *   GET /api/notes          → list of NoteSummary (no html)
 *   GET /api/notes/:slug    → full Note with html
 *   POST /api/invalidate    → bust KV cache (called from GitHub Actions)
 *
 * KV keys:
 *   notes:all               → serialised Note[] (full, with html)
 *   notes:ts                → ISO timestamp of last fetch
 */

import { parseNoteFile, attachBacklinks, titleToSlug } from './parser';
import { fetchAllNoteFiles, fetchAllNoteFilesRecursive } from './github';
import type { Env, Note, NoteSummary, ApiNotesResponse, ApiNoteResponse } from './types';

// ── CORS helper ───────────────────────────────────────────────────────────────

function corsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = env.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : [];

  const allowOrigin =
    allowed.includes(origin) || allowed.includes('*')
      ? origin
      : allowed[0] ?? '*';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data: unknown, status = 200, extra: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

function notFound(message: string, cors: HeadersInit): Response {
  return json({ error: message }, 404, cors);
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

const KV_KEY_ALL = 'notes:all';
const KV_KEY_TS = 'notes:ts';

async function getCachedNotes(env: Env): Promise<Note[] | null> {
  const ttl = parseInt(env.CACHE_TTL ?? '120', 10) * 1000;

  const tsRaw = await env.NOTES_CACHE.get(KV_KEY_TS);
  if (!tsRaw) return null;

  const age = Date.now() - new Date(tsRaw).getTime();
  if (age > ttl) return null;

  const cached = await env.NOTES_CACHE.get(KV_KEY_ALL);
  if (!cached) return null;

  return JSON.parse(cached) as Note[];
}

async function setCachedNotes(env: Env, notes: Note[]): Promise<void> {
  await Promise.all([
    env.NOTES_CACHE.put(KV_KEY_ALL, JSON.stringify(notes), { expirationTtl: 3600 }),
    env.NOTES_CACHE.put(KV_KEY_TS, new Date().toISOString(), { expirationTtl: 3600 }),
  ]);
}

async function bustCache(env: Env): Promise<void> {
  await Promise.all([
    env.NOTES_CACHE.delete(KV_KEY_ALL),
    env.NOTES_CACHE.delete(KV_KEY_TS),
  ]);
}

// ── Fetch + parse all notes from GitHub ──────────────────────────────────────

async function fetchAllNotes(env: Env): Promise<Note[]> {
  // Use GraphQL to fetch ALL notes in a single subrequest — no matter vault size.

  const recursive = (env as unknown as Record<string, string>)['NOTES_RECURSIVE'] === 'true';
  const subdir = (env as unknown as Record<string, string>)['NOTES_SUBDIR'] ?? '';
  const branch = (env as unknown as Record<string, string>)['NOTES_BRANCH'] ?? 'HEAD';

  const noteFiles = recursive
    ? await fetchAllNoteFilesRecursive(env.NOTES_REPO, env.GITHUB_TOKEN, branch)
    : await fetchAllNoteFiles(env.NOTES_REPO, env.GITHUB_TOKEN, branch, subdir);

  // Collect slugs first for wikilink resolution
  const allSlugs = noteFiles.map(f => titleToSlug(f.name.replace(/\.md$/i, '')));

  // Parse synchronously — all content is already in memory, no more I/O
  const notes = noteFiles.map(f => parseNoteFile(f.name, f.text, allSlugs));

  const published = notes.filter(n => n.published);
  const withLinks = attachBacklinks(published);
  return withLinks.sort((a, b) => (b.dateRaw ?? '').localeCompare(a.dateRaw ?? ''));
}

// ── Worker entrypoint ─────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request, env);

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/$/, ''); // strip trailing slash

    // ── GET /api/notes ──────────────────────────────────────────────────────
    if (request.method === 'GET' && pathname === '/api/notes') {
      try {
        let notes = await getCachedNotes(env);
        const fromCache = notes !== null;

        if (!notes) {
          notes = await fetchAllNotes(env);
          await setCachedNotes(env, notes);
        }

        const allTags = [...new Set(notes.flatMap(n => n.tags))].sort();
        const summaries: NoteSummary[] = notes.map(({ html: _html, ...rest }) => rest);

        const body: ApiNotesResponse = {
          notes: summaries,
          allTags,
          fetchedAt: new Date().toISOString(),
        };

        return json(body, 200, {
          ...cors,
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
          'X-Cache': fromCache ? 'HIT' : 'MISS',
        });

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[/api/notes]', msg);
        return json({ error: 'Failed to load notes', detail: msg }, 500, cors);
      }
    }

    // ── GET /api/notes/:slug ─────────────────────────────────────────────────
    const noteMatch = pathname.match(/^\/api\/notes\/([^/]+)$/);
    if (request.method === 'GET' && noteMatch) {
      const slug = noteMatch[1];

      try {
        let notes = await getCachedNotes(env);
        if (!notes) {
          notes = await fetchAllNotes(env);
          await setCachedNotes(env, notes);
        }

        const note = notes.find(n => n.slug === slug);
        if (!note) return notFound(`Note "${slug}" not found`, cors);

        const body: ApiNoteResponse = { note, fetchedAt: new Date().toISOString() };
        return json(body, 200, {
          ...cors,
          'Cache-Control': 'public, max-age=120, stale-while-revalidate=600',
        });

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[/api/notes/${slug}]`, msg);
        return json({ error: 'Failed to load note', detail: msg }, 500, cors);
      }
    }

    // ── POST /api/invalidate ─────────────────────────────────────────────────
    // Called by GitHub Actions after you push new notes.
    // Secured with a shared secret in the Authorization header.
    if (request.method === 'POST' && pathname === '/api/invalidate') {
      const auth = request.headers.get('Authorization') ?? '';
      // The secret is stored as a Worker secret: INVALIDATE_SECRET
      // Fallback: allow if no secret is configured (development)
      const secret = (env as unknown as Record<string, string>)['INVALIDATE_SECRET'];
      if (secret && auth !== `Bearer ${secret}`) {
        return json({ error: 'Unauthorized' }, 401, cors);
      }

      await bustCache(env);
      return json({ ok: true, message: 'Cache invalidated' }, 200, cors);
    }

    // ── 404 ──────────────────────────────────────────────────────────────────
    return notFound('Not found', cors);
  },

  // ── Cron keep-alive ────────────────────────────────────────────────────────
  // Runs every 5 minutes to prevent the isolate from going cold.
  // Just does a lightweight KV read — enough to keep the Worker warm.

  // ── Cron keep-alive ────────────────────────────────────────────────────────
  // Runs every 5 minutes to keep both this Worker and the Pages Function warm.
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    // Keep Worker warm — lightweight KV read
    await env.NOTES_CACHE.get('notes:ts');

    // Keep Pages Function warm — ping its root route
    const pagesUrl = (env as unknown as Record<string, string>)['PAGES_URL'];
    if (pagesUrl) {
      await fetch(pagesUrl, { method: 'GET', headers: { 'x-keepalive': '1' } })
        .catch(() => { }); // ignore errors — don't let a Pages hiccup break the cron
    }
  },
};
