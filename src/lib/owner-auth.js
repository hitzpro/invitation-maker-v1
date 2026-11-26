import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from './env.js';

export const OWNER_COOKIE = 'owner_session';
const EPHEMERAL_SECRET = randomBytes(32).toString('hex');

function signingSecret() {
  const secret = env('APP_SECRET')?.trim();
  return secret && secret.length >= 16 ? secret : EPHEMERAL_SECRET;
}

function sha256(str) {
  return createHash('sha256').update(str).digest();
}

function safeEqualText(a, b) {
  return timingSafeEqual(sha256(String(a)), sha256(String(b)));
}

export function isOwnerDashboardEnabled() {
  const envKey = env('OWNER_DASHBOARD_KEY')?.trim();
  return Boolean(envKey && envKey.length >= 4);
}

export function verifyOwnerPasscode(passcode) {
  const envKey = env('OWNER_DASHBOARD_KEY')?.trim();
  if (!envKey || envKey.length < 4) return false;
  return safeEqualText(passcode, envKey);
}

export function signOwnerCookieValue() {
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = `owner.${exp}`;
  const sig = createHmac('sha256', signingSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyOwnerCookie(cookieVal) {
  if (!isOwnerDashboardEnabled()) return false;
  if (typeof cookieVal !== 'string') return false;
  const parts = cookieVal.split('.');
  if (parts.length !== 3 || parts[0] !== 'owner') return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  const expected = createHmac('sha256', signingSecret()).update(payload).digest('base64url');
  return safeEqualText(parts[2], expected);
}

export function setOwnerCookie(cookies, request = null) {
  const isHttps =
    request?.headers?.get('x-forwarded-proto') === 'https' ||
    request?.url?.startsWith('https://');
  cookies.set(OWNER_COOKIE, signOwnerCookieValue(), {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
}

export function clearOwnerCookie(cookies) {
  cookies.delete(OWNER_COOKIE, { path: '/' });
}

export function isOwnerAuthorized(cookies) {
  if (!isOwnerDashboardEnabled()) return false;
  const cookieVal = cookies.get(OWNER_COOKIE)?.value;
  return verifyOwnerCookie(cookieVal);
}
