const OWNER = 'sem-moreau';
const REPO = 'swipe-review-csv';
const BRANCH = 'main';
const TOKEN_KEY = 'swipe-review-github-token';

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? '';
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token.trim());
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function base64ToUtf8(b64: string): string {
  const binary = atob(b64.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function api(path: string, token: string, init?: RequestInit): Promise<Response> {
  return fetch(`https://api.github.com/repos/${OWNER}/${REPO}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      ...(init?.headers ?? {}),
    },
  });
}

export async function verifyToken(token: string): Promise<boolean> {
  const res = await api('contents/public/lists/manifest.json', token);
  return res.ok;
}

export async function getFile(path: string, token: string): Promise<{ content: string; sha: string } | null> {
  const res = await api(`contents/${path}?ref=${BRANCH}`, token);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub-fout bij ophalen van ${path} (${res.status})`);
  const data = await res.json();
  return { content: base64ToUtf8(data.content), sha: data.sha };
}

async function putFileOnce(path: string, content: string, message: string, token: string, sha?: string): Promise<Response> {
  return api(`contents/${path}`, token, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: utf8ToBase64(content),
      branch: BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });
}

/**
 * Writes a file via the Contents API. If another write raced us and the sha is stale (409),
 * refetch the current sha and retry once — keeps concurrent admin edits from failing outright.
 */
export async function putFile(path: string, content: string, message: string, token: string, sha?: string): Promise<void> {
  let res = await putFileOnce(path, content, message, token, sha);
  if (res.status === 409) {
    const latest = await getFile(path, token);
    res = await putFileOnce(path, content, message, token, latest?.sha);
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub-fout bij opslaan van ${path} (${res.status}): ${body.slice(0, 200)}`);
  }
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
