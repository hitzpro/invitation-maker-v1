import { env } from './env.js';

const DEFAULT_USERNAME = 'username-github';
const DEFAULT_REPO_NAME = 'undangan-digital';

function normalizeUrl(value, fallback) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return fallback;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function getCreatorBranding() {
  const rawUsername = env('CREATOR_GITHUB_USERNAME')?.trim() || DEFAULT_USERNAME;
  const cleanUsername = rawUsername.replace(/^@+/, '');
  const isConfigured = cleanUsername !== DEFAULT_USERNAME && cleanUsername.length > 0;

  const githubUrl = normalizeUrl(
    env('CREATOR_GITHUB_URL'),
    `https://github.com/${cleanUsername}`
  );
  const repoUrl = normalizeUrl(
    env('CREATOR_REPO_URL'),
    `https://github.com/${cleanUsername}/${DEFAULT_REPO_NAME}`
  );

  return {
    username: cleanUsername,
    displayHandle: isConfigured ? `@${cleanUsername}` : 'GitHub Pembuat',
    githubUrl,
    repoUrl,
    isConfigured,
  };
}
