export const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

// Mengembalikan Response error kalau gagal, atau null kalau lolos
export function guardUser(locals) {
  return locals.user ? null : json(401, { error: 'Unauthorized' });
}

export function guardAdmin(locals) {
  return guardUser(locals) ?? (locals.user.role === 'admin' ? null : json(403, { error: 'Forbidden' }));
}