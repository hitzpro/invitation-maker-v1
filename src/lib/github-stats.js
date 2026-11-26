import { getCreatorBranding } from './branding.js';
import { env } from './env.js';

const REPO_SLUG_RE = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;
const CACHE_TTL_MS = 5 * 60 * 1000;
let cached = { key: '', at: 0, data: null };

export function resolveGithubRepoSlug() {
  const explicit = env('GITHUB_REPO')?.trim();
  if (explicit && REPO_SLUG_RE.test(explicit)) return explicit;

  const { repoUrl, isConfigured } = getCreatorBranding();
  if (!isConfigured) return null;

  try {
    const parsed = new URL(repoUrl);
    if (parsed.hostname.toLowerCase() !== 'github.com') return null;
    const slug = parsed.pathname.replace(/^\/+|\/+$/g, '').replace(/\.git$/i, '');
    return REPO_SLUG_RE.test(slug) ? slug : null;
  } catch {
    return null;
  }
}

async function fetchGithubJson(endpoint, token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'undangan-digital-owner-dashboard',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com${endpoint}`, {
    headers,
    signal: AbortSignal.timeout(6000),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

export async function getGithubProjectStats(forceRefresh = false) {
  const repoSlug = resolveGithubRepoSlug();
  const token = env('GITHUB_TOKEN')?.trim() || '';
  const cacheKey = `${repoSlug ?? ''}:${Boolean(token)}`;

  if (!forceRefresh && cached.key === cacheKey && Date.now() - cached.at < CACHE_TTL_MS && cached.data) {
    return cached.data;
  }

  if (!repoSlug) {
    const empty = {
      configured: false,
      tokenPresent: Boolean(token),
      repoSlug: null,
      error: 'Atur CREATOR_GITHUB_USERNAME / CREATOR_REPO_URL atau GITHUB_REPO di environment.',
    };
    cached = { key: cacheKey, at: Date.now(), data: empty };
    return empty;
  }

  try {
    const repoRes = await fetchGithubJson(`/repos/${repoSlug}`, token);
    if (!repoRes.ok) {
      const errData = {
        configured: true,
        tokenPresent: Boolean(token),
        repoSlug,
        error:
          repoRes.status === 404
            ? `Repositori "${repoSlug}" tidak ditemukan atau bersifat privat.`
            : repoRes.body?.message || `GitHub API mengembalikan status ${repoRes.status}.`,
      };
      cached = { key: cacheKey, at: Date.now(), data: errData };
      return errData;
    }

    const r = repoRes.body;
    const result = {
      configured: true,
      tokenPresent: Boolean(token),
      repoSlug,
      htmlUrl: r.html_url,
      stars: Number(r.stargazers_count) || 0,
      forks: Number(r.forks_count) || 0,
      watchers: Number(r.subscribers_count) || 0,
      openIssues: Number(r.open_issues_count) || 0,
      pushedAt: r.pushed_at || null,
      traffic: null,
      trafficError: null,
    };

    if (token) {
      const [clonesRes, viewsRes] = await Promise.all([
        fetchGithubJson(`/repos/${repoSlug}/traffic/clones`, token),
        fetchGithubJson(`/repos/${repoSlug}/traffic/views`, token),
      ]);

      if (clonesRes.ok) {
        result.traffic = {
          clonesCount: Number(clonesRes.body.count) || 0,
          clonesUniques: Number(clonesRes.body.uniques) || 0,
          clonesDaily: Array.isArray(clonesRes.body.clones) ? clonesRes.body.clones : [],
          viewsCount: viewsRes.ok ? Number(viewsRes.body.count) || 0 : null,
          viewsUniques: viewsRes.ok ? Number(viewsRes.body.uniques) || 0 : null,
        };
      } else {
        result.trafficError =
          clonesRes.status === 403
            ? 'GITHUB_TOKEN tidak memiliki izin Administration/Traffic Read untuk repo ini.'
            : clonesRes.body?.message || `Gagal membaca traffic clones (${clonesRes.status}).`;
      }
    }

    cached = { key: cacheKey, at: Date.now(), data: result };
    return result;
  } catch (err) {
    return {
      configured: true,
      tokenPresent: Boolean(token),
      repoSlug,
      error: `Gagal menghubungi GitHub API: ${err?.message || 'timeout'}`,
    };
  }
}
