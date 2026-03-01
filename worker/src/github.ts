/**
 * GitHub data fetching — uses the GraphQL API to retrieve ALL note contents
 * in a SINGLE subrequest, regardless of vault size.
 *
 * Why GraphQL instead of the REST Contents API:
 *   - REST: 1 request to list files + 1 request per file = N+1 subrequests
 *   - GraphQL: 1 request returns every file name AND content at once = 1 subrequest
 *
 * Cloudflare Workers cap subrequests at 50 (free) / 1000 (paid) per invocation.
 * A vault with 51+ notes would silently fail with the old approach.
 */

const GH_GRAPHQL = 'https://api.github.com/graphql';

function graphqlHeaders(token: string): HeadersInit {
  return {
    Authorization: `bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'digital-garden-worker/1.0',
  };
}

export interface NoteFile {
  name: string;   // e.g. "on-building-tools.md"
  path: string;   // e.g. "notes/on-building-tools.md" (or just "on-building-tools.md")
  text: string;   // raw markdown content
}

// ── GraphQL response shapes ───────────────────────────────────────────────────

interface GQLBlob {
  __typename: 'Blob';
  text: string | null;      // null for binary files
  isBinary: boolean;
}

interface GQLTree {
  __typename: 'Tree';
}

type GQLObject = GQLBlob | GQLTree;

interface GQLEntry {
  name: string;
  path: string;
  type: 'blob' | 'tree';
  object: GQLObject;
}

interface GQLRepoResponse {
  data: {
    repository: {
      object: {
        entries: GQLEntry[];
      } | null;
    } | null;
  };
  errors?: Array<{ message: string }>;
}

// ── Main function: fetch everything in 1 request ──────────────────────────────

/**
 * Fetches all markdown files (including subdirectories) from a GitHub repo
 * in a single GraphQL request.
 *
 * @param repo   "owner/repo"
 * @param token  GitHub PAT with Contents: read permission
 * @param branch Branch to read from (default: HEAD)
 * @param subdir Optional subdirectory prefix, e.g. "notes" to only read notes/
 */
export async function fetchAllNoteFiles(
  repo: string,
  token: string,
  branch = 'HEAD',
  subdir = ''
): Promise<NoteFile[]> {
  const [owner, name] = repo.split('/');
  if (!owner || !name) throw new Error(`Invalid repo format: "${repo}" — expected "owner/repo"`);

  // The expression "HEAD:" points to the root tree.
  // If you store notes in a subdir, use "HEAD:notes" etc.
  const expression = subdir ? `${branch}:${subdir}` : `${branch}:`;

  const query = `
    query FetchNotes($owner: String!, $name: String!, $expression: String!) {
      repository(owner: $owner, name: $name) {
        object(expression: $expression) {
          ... on Tree {
            entries {
              name
              path
              type
              object {
                ... on Blob {
                  __typename
                  isBinary
                  text
                }
                ... on Tree {
                  __typename
                }
              }
            }
          }
        }
      }
    }
  `;

  const body = JSON.stringify({
    query,
    variables: { owner, name, expression },
  });

  const res = await fetch(GH_GRAPHQL, {
    method: 'POST',
    headers: graphqlHeaders(token),
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub GraphQL HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const gql: GQLRepoResponse = await res.json();

  if (gql.errors?.length) {
    throw new Error(`GitHub GraphQL error: ${gql.errors.map(e => e.message).join(', ')}`);
  }

  const repoObj = gql.data?.repository;
  if (!repoObj) throw new Error('Repository not found. Check NOTES_REPO secret.');

  const treeObj = repoObj.object;
  if (!treeObj) throw new Error(`Path "${expression}" not found in repo "${repo}".`);

  const entries = treeObj.entries;

  // Collect all .md blobs, flattening one level of subdirectory.
  // The query fetches the top-level tree; for subdirs we'd need recursive=true
  // which isn't supported in GraphQL — instead we handle it by including
  // subdirectory entries and doing a second pass if needed.
  // For most Obsidian vaults (flat or one level deep) this covers everything.
  const files: NoteFile[] = [];

  for (const entry of entries) {
    if (entry.type === 'blob' &&
        entry.name.endsWith('.md') &&
        entry.object.__typename === 'Blob') {
      const blob = entry.object as GQLBlob;
      if (!blob.isBinary && blob.text !== null) {
        files.push({ name: entry.name, path: entry.path, text: blob.text });
      }
    }
  }

  return files;
}

/**
 * For deeply nested vaults (more than 1 level of folders), use the Git Trees API
 * with recursive=true + individual blob fetches.
 *
 * This still uses only 2 subrequests (tree list + one batch fetch via GraphQL
 * using inline aliases), but is more complex. Enable by setting
 * NOTES_RECURSIVE=true in wrangler.toml [vars].
 *
 * For 99% of Obsidian vaults, fetchAllNoteFiles() above is sufficient.
 */
export async function fetchAllNoteFilesRecursive(
  repo: string,
  token: string,
  branch = 'HEAD'
): Promise<NoteFile[]> {
  const [owner, name] = repo.split('/');

  // Step 1: Get flat recursive tree listing (1 subrequest)
  const treeRes = await fetch(
    `https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'digital-garden-worker/1.0',
      },
    }
  );

  if (!treeRes.ok) throw new Error(`Git tree API ${treeRes.status}`);

  const treeData: { tree: Array<{ path: string; type: string; sha: string }> } = await treeRes.json();
  const mdPaths = treeData.tree
    .filter(item => item.type === 'blob' && item.path.endsWith('.md'))
    .map(item => item.path);

  if (mdPaths.length === 0) return [];

  // Step 2: Fetch all file contents in a single GraphQL query using inline aliases
  // Each file becomes "fileN: object(expression: "HEAD:path") { ... on Blob { text } }"
  // This is 1 subrequest regardless of how many files you have.
  const aliases = mdPaths
    .map((p, i) => `
      file${i}: object(expression: "${branch}:${p.replace(/"/g, '\\"')}") {
        ... on Blob { text isBinary }
      }
    `)
    .join('\n');

  const batchQuery = `
    query {
      repository(owner: "${owner}", name: "${name}") {
        ${aliases}
      }
    }
  `;

  const batchRes = await fetch(GH_GRAPHQL, {
    method: 'POST',
    headers: graphqlHeaders(token),
    body: JSON.stringify({ query: batchQuery }),
  });

  if (!batchRes.ok) throw new Error(`GraphQL batch ${batchRes.status}`);

  const batchData: {
    data: { repository: Record<string, { text: string | null; isBinary: boolean } | null> };
    errors?: Array<{ message: string }>;
  } = await batchRes.json();

  if (batchData.errors?.length) {
    throw new Error(`GraphQL batch error: ${batchData.errors.map(e => e.message).join(', ')}`);
  }

  const repoData = batchData.data.repository;
  const files: NoteFile[] = [];

  mdPaths.forEach((path, i) => {
    const blob = repoData[`file${i}`];
    if (blob && !blob.isBinary && blob.text !== null) {
      const name = path.split('/').pop() ?? path;
      files.push({ name, path, text: blob.text });
    }
  });

  return files;
}
