import 'dotenv/config';
import { checkForUpdates, applyUpdateSync } from '../src/lib/updater.js';

console.log('[sync] Memeriksa pembaruan dari repositori GitHub...');
const status = await checkForUpdates();

if (!status.ok) {
  console.error('[sync] Gagal memeriksa pembaruan:', status.error);
  process.exit(1);
}

if (!status.gitAvailable) {
  console.error('[sync]', status.reason);
  process.exit(1);
}

if (!status.hasUpdates) {
  console.log(`[sync] Aplikasi sudah versi terbaru (${status.branch} @ ${status.localCommit}).`);
  process.exit(0);
}

console.log(`[sync] Ditemukan ${status.behindCount} pembaruan baru. Menerapkan sinkronisasi...`);
const res = await applyUpdateSync();

if (!res.ok) {
  console.error('[sync] Sinkronisasi gagal:', res.error);
  process.exit(1);
}

console.log(`[sync] Berhasil diperbarui: ${res.previousCommit} -> ${res.newCommit}`);
if (res.ranInstall) console.log('[sync] Dependensi diperbarui.');
if (res.ranMigrate) console.log('[sync] Migrasi database dijalankan.');
if (res.ranBuild) console.log('[sync] Build produksi diperbarui.');
for (const w of res.warnings ?? []) console.warn('[sync] Catatan:', w);
console.log('[sync]', res.message);
