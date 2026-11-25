import { SESSION_COOKIE, deleteSession } from '../../lib/session.js';

export async function POST({ cookies, redirect }) {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(token);
  cookies.delete(SESSION_COOKIE, { path: '/' });
  return redirect('/login', 303);
}