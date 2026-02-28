import type { GHFile, GHFileContent } from './types';

const GH_API = 'https://api.github.com';

function ghHeaders(token: string): HeadersInit {
  return {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'digital-garden-worker/1.0',
  };
}

/** List all markdown files in a repo directory */
export async function listMarkdownFiles(
  repo: string,
  token: string,
  path = ''
): Promise<GHFile[]> {
  const url = `${GH_API}/repos/${repo}/contents/${path}`;
  const res = await fetch(url, { headers: ghHeaders(token) });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const items: GHFile[] = await res.json();

  // Recursively collect .md files from subdirectories
  const result: GHFile[] = [];
  await Promise.all(
    items.map(async item => {
      if (item.type === 'file' && item.name.endsWith('.md')) {
        result.push(item);
      } else if (item.type === 'dir') {
        // Recurse one level (adjust if you need deeper nesting)
        const sub = await listMarkdownFiles(repo, token, item.path);
        result.push(...sub);
      }
    })
  );

  return result;
}

/** Fetch the raw text content of a file by its download_url */
export async function fetchFileContent(downloadUrl: string): Promise<string> {
  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error(`Failed to fetch ${downloadUrl}: ${res.status}`);
  return res.text();
}

/** Fetch file content via contents API (works with private repos using token auth) */
export async function fetchFileByPath(
  repo: string,
  filePath: string,
  token: string
): Promise<string> {
  const url = `${GH_API}/repos/${repo}/contents/${filePath}`;
  const res = await fetch(url, { headers: ghHeaders(token) });

  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${filePath}`);

  const data: GHFileContent = await res.json();

  if (data.encoding !== 'base64') {
    throw new Error(`Unexpected encoding: ${data.encoding}`);
  }

  // Cloudflare Workers support atob()
  return atob(data.content.replace(/\n/g, ''));
}
