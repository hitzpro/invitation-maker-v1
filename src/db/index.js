import { existsSync } from 'node:fs';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

function createNoopDb() {
  const emptyChain = {
    from: () => emptyChain,
    innerJoin: () => emptyChain,
    where: () => emptyChain,
    orderBy: () => emptyChain,
    limit: () => emptyChain,
    offset: () => emptyChain,
    for: () => emptyChain,
    set: () => emptyChain,
    values: () => emptyChain,
    onConflictDoUpdate: () => emptyChain,
    returning: () => emptyChain,
    then: (resolve) => Promise.resolve([]).then(resolve),
  };
  const noop = {
    select: () => emptyChain,
    insert: () => emptyChain,
    update: () => emptyChain,
    delete: () => emptyChain,
    transaction: async (fn) => fn(noop),
    execute: async () => ({ rows: [{ '?column?': 1 }] }),
  };
  return noop;
}

async function loadFallbackDb() {
  try {
    const mockUrl = new URL('./mock.js', import.meta.url);
    if (existsSync(mockUrl)) {
      const mod = await import(/* @vite-ignore */ mockUrl.href);
      if (mod?.mockDb) return mod.mockDb;
    }
  } catch {
    // Abaikan jika ./mock.js tidak tersedia di repositori lokal
  }
  return createNoopDb();
}

const connectionString = process.env.DATABASE_URL ?? import.meta.env?.DATABASE_URL;

let db;
let usingFallback = false;

if (connectionString) {
  let pool;
  try {
    const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
    pool = new pg.Pool({
      connectionString,
      connectionTimeoutMillis: 5000,
      max: isVercel ? 3 : 10,
    });
    await pool.query('SELECT 1');
    db = drizzle(pool, { schema });
  } catch (err) {
    console.warn('[db] Database tidak dapat dijangkau — menggunakan mode fallback:', err?.message || err?.code);
    await pool?.end().catch(() => {});
    db = await loadFallbackDb();
    usingFallback = true;
  }
} else {
  console.warn('[db] DATABASE_URL belum diatur — menggunakan mode fallback');
  db = await loadFallbackDb();
  usingFallback = true;
}

export const isMockDb = usingFallback;
export { db };