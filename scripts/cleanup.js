import 'dotenv/config';
import { readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? './uploads');
const cacheDir = path.join(path.dirname(uploadDir), 'cache');

const ORPHAN_GRACE_MS = 60 * 60 * 1000;       // 1 jam (hindari hapus file yang baru diupload)
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 hari

async function walkFiles(dir) {
  const out = [];
  let entries = [];
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walkFiles(full)));
    else if (e.isFile()) out.push(full);
  }
  return out;
}

try {
  // 1. Hapus sesi kedaluwarsa
  const expired = await pool.query('DELETE FROM sessions WHERE expires_at < NOW()');
  console.log(`Sesi kedaluwarsa dihapus: ${expired.rowCount}`);

  // 2. Ambil daftar filename valid dari DB, lalu hapus file yatim di UPLOAD_DIR
  const { rows } = await pool.query('SELECT filename FROM invitation_assets');
  const validFiles = new Set(rows.map((r) => r.filename));
  const now = Date.now();
  let orphanCount = 0;

  for (const full of await walkFiles(uploadDir)) {
    const name = path.basename(full);
    if (name === '.gitkeep' || validFiles.has(name)) continue;
    const info = await stat(full);
    if (now - info.mtimeMs > ORPHAN_GRACE_MS) {
      await unlink(full).catch(() => {});
      orphanCount++;
    }
  }
  console.log(`File yatim dihapus: ${orphanCount}`);

  // 3. Hapus file cache gambar/OG yang sudah lebih dari 30 hari
  let cacheCount = 0;
  for (const full of await walkFiles(cacheDir)) {
    const info = await stat(full);
    if (now - info.atimeMs > CACHE_TTL_MS) {
      await unlink(full).catch(() => {});
      cacheCount++;
    }
  }
  console.log(`Cache lama dihapus: ${cacheCount}`);
} finally {
  await pool.end();
}