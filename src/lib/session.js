import { randomBytes, createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { sessions, users } from '../db/schema.js';
import { env } from './env.js';

export const SESSION_COOKIE = 'session';
const SESSION_DAYS = 30;

const hashToken = (token) => createHash('sha256').update(token).digest('hex');

export async function createSession(userId) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function validateSession(token) {
  const id = hashToken(token);
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, id))
    .limit(1);

  if (!row) return null;

  if (row.session.expiresAt < new Date() || !row.user.isActive) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }

  const { id: userId, email, name, role } = row.user;
  return { id: userId, email, name, role };
}

export async function deleteSession(token) {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

export function setSessionCookie(cookies, token, expiresAt) {
  cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: (env('APP_URL') ?? '').startsWith('https://'),
    path: '/',
    expires: expiresAt,
  });
}