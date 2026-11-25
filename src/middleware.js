import { defineMiddleware } from 'astro:middleware';
import { SESSION_COOKIE, validateSession } from './lib/session.js';

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

  return next();
});