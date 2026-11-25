import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return new Response(JSON.stringify({ ok: true, db: 'up' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false, db: 'down' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
}