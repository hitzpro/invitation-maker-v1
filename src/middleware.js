import { defineMiddleware } from 'astro:middleware';
import { SESSION_COOKIE, validateSession } from './lib/session.js';
import { assertEnv, env } from './lib/env.js';

assertEnv();


// Rute yang wajib login
const AUTH_REQUIRED = ['/dashboard', '/admin', '/api/admin', '/api/invitations'];
// Rute khusus administrator
const ADMIN_ONLY = ['/admin', '/api/admin'];

const matches = (pathname, prefixes) =>
  prefixes.some((p) => pathname === p || pathname.startsWith(p + '/'));

const jsonError = (status, message) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.user = null;

  const token = context.cookies.get(SESSION_COOKIE)?.value;
  if (token) context.locals.user = await validateSession(token);

  const { pathname } = context.url;
  const isApi = pathname.startsWith('/api/');
  const user = context.locals.user;

  if (matches(pathname, AUTH_REQUIRED)) {
    if (!user) {
      return isApi ? jsonError(401, 'Unauthorized') : context.redirect('/login');
    }
    if (matches(pathname, ADMIN_ONLY) && user.role !== 'admin') {
      return isApi ? jsonError(403, 'Forbidden') : context.rewrite('/403');
    }
  }

  const response = await next();
  const isPreview = /^\/dashboard\/invitations\/[^/]+\/preview$/.test(pathname);
  const framePolicy = isPreview ? "'self'" : "'none'";

  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "media-src 'self'",
    "connect-src 'self'",
    "frame-src 'self' https://maps.google.com https://www.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${framePolicy}`,
  ].join('; ');

  const headers = new Headers(response.headers);
  headers.set('Content-Security-Policy', csp);
  headers.set('X-Frame-Options', isPreview ? 'SAMEORIGIN' : 'DENY');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  if ((env('APP_URL') ?? '').startsWith('https://')) {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});