#!/usr/bin/env node
import { execFile, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import readline from 'node:readline/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const NPM_BIN = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const ENV_PATH = path.join(ROOT, '.env');
const ENV_EXAMPLE_PATH = path.join(ROOT, '.env.example');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function line(char = '─', len = 60) {
  return char.repeat(len);
}

function header(title) {
  console.log(`\n${line()}`);
  console.log(`  ${title}`);
  console.log(`${line()}\n`);
}

function ok(msg) {
  console.log(`  [OK] ${msg}`);
}

function info(msg) {
  console.log(`  [i]  ${msg}`);
}

function warn(msg) {
  console.log(`  [!]  ${msg}`);
}

function fail(msg) {
  console.log(`  [X]  ${msg}`);
}

async function ask(prompt, defaultVal = '') {
  const suffix = defaultVal ? ` [${defaultVal}]` : '';
  const ans = await rl.question(`  > ${prompt}${suffix}: `);
  const trimmed = ans.trim();
  return trimmed || defaultVal;
}

async function choose(title, options) {
  console.log(`\n  ${title}`);
  options.forEach((opt, i) => {
    console.log(`    [${i + 1}] ${opt.label}`);
  });
  while (true) {
    const raw = (await rl.question(`  > Pilih nomor (1-${options.length}): `)).trim();
    const idx = Number.parseInt(raw, 10) - 1;
    if (Number.isInteger(idx) && idx >= 0 && idx < options.length) {
      return options[idx].value;
    }
    warn(`Masukkan angka 1 sampai ${options.length}.`);
  }
}

function runInherit(bin, args) {
  return new Promise((resolve) => {
    const child = spawn(bin, args, {
      cwd: ROOT,
      stdio: 'inherit',
      shell: process.platform === 'win32' && bin.endsWith('.cmd'),
    });
    child.on('close', (code) => resolve(code === 0));
    child.on('error', () => resolve(false));
  });
}

async function runQuiet(bin, args, timeout = 15000) {
  try {
    const { stdout, stderr } = await execFileAsync(bin, args, {
      cwd: ROOT,
      timeout,
      shell: process.platform === 'win32' && bin.endsWith('.cmd'),
    });
    return { ok: true, stdout: String(stdout ?? '').trim(), stderr: String(stderr ?? '').trim() };
  } catch (err) {
    return {
      ok: false,
      stdout: String(err?.stdout ?? '').trim(),
      stderr: String(err?.stderr ?? err?.message ?? '').trim(),
    };
  }
}

function parseEnvFile(filePath) {
  const map = new Map();
  const order = [];
  if (!existsSync(filePath)) return { map, order };
  const raw = readFileSync(filePath, 'utf8');
  for (const lineStr of raw.split(/\r?\n/)) {
    const trimmed = lineStr.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = lineStr.indexOf('=');
    if (eqIdx === -1) continue;
    const key = lineStr.slice(0, eqIdx).trim();
    let val = lineStr.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!map.has(key)) order.push(key);
    map.set(key, val);
  }
  return { map, order };
}

function writeEnvFile(valuesMap) {
  const baseKeys = parseEnvFile(ENV_EXAMPLE_PATH).order;
  const allKeys = [...new Set([...baseKeys, ...valuesMap.keys()])];
  const lines = allKeys.map((k) => `${k}=${valuesMap.get(k) ?? ''}`);
  writeFileSync(ENV_PATH, `${lines.join('\n')}\n`, 'utf8');
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '0.0.0.0');
  });
}

function sanitizeDbUrl(raw) {
  let clean = raw.trim();
  if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
    clean = clean.slice(1, -1).trim();
  }
  // Handle jika user menyalin "psql 'postgresql://...'" dari dashboard Neon
  const psqlMatch = clean.match(/^psql\s+['"]?(postgres(?:ql)?:\/\/[^'"\s]+)['"]?$/i);
  if (psqlMatch) clean = psqlMatch[1];
  return clean;
}

function ensureSslParam(urlStr) {
  try {
    const u = new URL(urlStr);
    if (!u.searchParams.has('sslmode')) {
      u.searchParams.set('sslmode', 'require');
    }
    return u.toString();
  } catch {
    return urlStr;
  }
}

async function testDatabaseConnection(connectionString) {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({
    connectionString,
    connectionTimeoutMillis: 6000,
  });
  try {
    await pool.query('SELECT 1');
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      code: err?.code || '',
      message: err?.message || 'Gagal terhubung ke database.',
    };
  } finally {
    await pool.end().catch(() => {});
  }
}

function diagnoseDbError(res) {
  const msg = `${res.code} ${res.message}`.toLowerCase();
  if (msg.includes('econnrefused')) {
    return 'Server database belum menyala atau port tidak sesuai.';
  }
  if (msg.includes('28p01') || msg.includes('password authentication')) {
    return 'Username atau password database salah.';
  }
  if (msg.includes('3d000') || msg.includes('does not exist')) {
    return 'Nama database belum dibuat di server PostgreSQL.';
  }
  if (msg.includes('ssl') || msg.includes('no pg_hba.conf') || msg.includes('self-signed')) {
    return 'Server database mewajibkan koneksi SSL (?sslmode=require).';
  }
  if (msg.includes('enotfound') || msg.includes('getaddrinfo')) {
    return 'Alamat host database tidak ditemukan. Periksa koneksi internet atau link yang ditempel.';
  }
  return res.message;
}

async function ensureDependencies() {
  header('Langkah 1/4 — Cek Lingkungan & Dependensi');

  const major = Number(process.versions.node.split('.')[0]);
  if (major < 22) {
    warn(`Versi Node.js Anda v${process.versions.node}. Disarankan minimal Node.js v22 LTS.`);
    info('Unduh versi terbaru di: https://nodejs.org');
  } else {
    ok(`Node.js v${process.versions.node} siap.`);
  }

  const gitRes = await runQuiet('git', ['--version'], 5000);
  if (gitRes.ok) {
    ok(`${gitRes.stdout} terdeteksi (sinkronisasi update 1-klik didukung).`);
  } else {
    warn('Git belum terdeteksi. Aplikasi tetap bisa jalan, tapi fitur update 1-klik membutuhkan Git.');
  }

  const hasPg = existsSync(path.join(ROOT, 'node_modules', 'pg'));
  const hasAstro = existsSync(path.join(ROOT, 'node_modules', 'astro'));
  if (hasPg && hasAstro) {
    ok('Paket aplikasi (node_modules) sudah terpasang.');
    return true;
  }

  while (true) {
    info('Memasang paket aplikasi (npm install)... Mohon tunggu sebentar.');
    const success = await runInherit(NPM_BIN, ['install', '--no-audit', '--no-fund']);
    if (success) {
      ok('Semua paket aplikasi berhasil dipasang.');
      return true;
    }

    fail('Gagal menjalankan npm install.');
    const action = await choose('Pilih solusi untuk melanjutkan:', [
      { value: 'retry', label: 'Coba ulang npm install sekarang' },
      { value: 'clean', label: 'Bersihkan cache npm lalu install ulang' },
      { value: 'abort', label: 'Keluar dulu untuk cek koneksi internet' },
    ]);

    if (action === 'clean') {
      await runInherit(NPM_BIN, ['cache', 'clean', '--force']);
    } else if (action === 'abort') {
      return false;
    }
  }
}

async function prepareEnvDefaults() {
  header('Langkah 2/4 — Siapkan File Pengaturan (.env)');

  const envMap = parseEnvFile(ENV_EXAMPLE_PATH).map;
  const existing = parseEnvFile(ENV_PATH).map;
  for (const [k, v] of existing.entries()) {
    if (v) envMap.set(k, v);
  }

  if (!envMap.get('APP_SECRET') || envMap.get('APP_SECRET').length < 16) {
    envMap.set('APP_SECRET', randomBytes(24).toString('hex'));
    ok('APP_SECRET keamanan dibuat otomatis.');
  } else {
    ok('APP_SECRET sudah tersedia.');
  }

  const port = Number(envMap.get('APP_PORT')) || 3000;
  envMap.set('APP_PORT', String(port));
  if (!envMap.get('APP_URL')) envMap.set('APP_URL', `http://localhost:${port}`);
  if (!envMap.get('UPLOAD_DIR')) envMap.set('UPLOAD_DIR', './data/uploads');
  if (!envMap.get('MAX_UPLOAD_SIZE_MB')) envMap.set('MAX_UPLOAD_SIZE_MB', '20');
  if (!envMap.get('MAX_AUDIO_SIZE_MB')) envMap.set('MAX_AUDIO_SIZE_MB', '10');
  envMap.set('DEMO_MODE', 'false');

  const uploadPath = path.resolve(ROOT, envMap.get('UPLOAD_DIR'));
  mkdirSync(uploadPath, { recursive: true });
  writeEnvFile(envMap);
  ok('File .env disiapkan dengan DEMO_MODE=false (mode penuh lokal).');

  const portFree = await isPortAvailable(port);
  if (!portFree) {
    warn(`Port ${port} saat ini sedang dipakai program lain di komputer Anda.`);
    info('Anda tetap bisa melanjutkan setup sekarang; nanti pastikan port 3000 tidak bentrok saat menjalankan server.');
  }

  return envMap;
}

async function promptCloudDbUrl() {
  console.log('\n  Panduan Singkat Cloud Database Gratis (Tanpa Docker / Tanpa WSL):');
  console.log('    1. Buka https://neon.tech atau https://supabase.com lalu daftar gratis.');
  console.log('    2. Buat 1 project baru.');
  console.log('    3. Salin "Connection String" PostgreSQL (diawali postgresql://...).\n');

  while (true) {
    const raw = await ask('Tempel link PostgreSQL di sini (atau ketik "batal")');
    if (raw.toLowerCase() === 'batal') return null;
    const cleaned = sanitizeDbUrl(raw);
    if (/^postgres(ql)?:\/\/.+/i.test(cleaned)) {
      return cleaned;
    }
    warn('Format link belum valid. Pastikan diawali postgresql:// atau postgres://');
  }
}

async function promptDockerDbUrl() {
  while (true) {
    const ver = await runQuiet('docker', ['--version'], 5000);
    if (!ver.ok) {
      fail('Docker tidak ditemukan di komputer Anda.');
      const next = await choose('Pilih langkah selanjutnya:', [
        { value: 'cloud', label: 'Pindah ke Cloud Database Gratis (Neon / Supabase) — tanpa Docker!' },
        { value: 'local', label: 'Pakai PostgreSQL yang sudah terinstall manual' },
        { value: 'cancel', label: 'Kembali ke menu database' },
      ]);
      return { switchTo: next };
    }

    const daemon = await runQuiet('docker', ['info'], 10000);
    if (!daemon.ok) {
      fail('Docker terpasang, tetapi Docker Desktop / WSL engine belum menyala.');
      const next = await choose('Pilih solusi untuk melanjutkan:', [
        { value: 'retry', label: 'Saya sudah buka Docker Desktop — cek ulang sekarang' },
        { value: 'cloud', label: 'Pindah ke Cloud Database Gratis (tanpa ribet WSL/Docker!)' },
        { value: 'local', label: 'Pakai PostgreSQL lokal tanpa Docker' },
      ]);
      if (next === 'retry') continue;
      return { switchTo: next };
    }

    info('Menyalakan container PostgreSQL (docker compose up -d)...');
    const upOk = await runInherit('docker', ['compose', 'up', '-d']);
    if (!upOk) {
      fail('Gagal menjalankan docker compose up -d.');
      const next = await choose('Pilih solusi untuk melanjutkan:', [
        { value: 'retry', label: 'Coba ulang docker compose up -d' },
        { value: 'cloud', label: 'Pindah ke Cloud Database Gratis (Neon / Supabase)' },
        { value: 'local', label: 'Pakai PostgreSQL lokal tanpa Docker' },
      ]);
      if (next === 'retry') continue;
      return { switchTo: next };
    }

    ok('Container PostgreSQL Docker berhasil menyala.');
    // Tunggu sebentar agar Postgres siap menerima koneksi
    await new Promise((r) => setTimeout(r, 2000));
    return { url: 'postgresql://undangan:undangan_dev_password@localhost:5433/undangan' };
  }
}

async function promptLocalPostgresUrl() {
  console.log('\n  Masukkan detail PostgreSQL lokal Anda:');
  const host = await ask('Host', 'localhost');
  const port = await ask('Port', '5432');
  const user = await ask('Username', 'postgres');
  const pass = await ask('Password');
  const dbName = await ask('Nama database', 'undangan');

  const u = encodeURIComponent(user);
  const p = encodeURIComponent(pass);
  return `postgresql://${u}:${p}@${host}:${port}/${encodeURIComponent(dbName)}`;
}

async function configureDatabase(envMap) {
  header('Langkah 3/4 — Hubungkan Database PostgreSQL');

  const existingUrl = envMap.get('DATABASE_URL')?.trim();
  if (existingUrl) {
    info('Mengecek koneksi DATABASE_URL yang sudah ada di .env...');
    const check = await testDatabaseConnection(existingUrl);
    if (check.ok) {
      ok('Koneksi database dari .env sudah aktif dan terhubung!');
      const keep = await choose('Gunakan database yang sudah terhubung ini?', [
        { value: 'yes', label: 'Ya, lanjut pakai database ini' },
        { value: 'no', label: 'Ganti dengan database baru' },
      ]);
      if (keep === 'yes') return existingUrl;
    } else {
      warn(`Database di .env belum terhubung: ${diagnoseDbError(check)}`);
    }
  }

  let mode = await choose('Pilih metode database yang paling nyaman untuk Anda:', [
    { value: 'cloud', label: 'Cloud Database Gratis (Neon / Supabase) — Paling Mudah, Tanpa Docker/WSL!' },
    { value: 'docker', label: 'Docker Desktop (docker compose up -d)' },
    { value: 'local', label: 'PostgreSQL Lokal (Sudah terinstall manual di komputer)' },
  ]);

  let currentUrl = null;

  while (true) {
    if (!currentUrl) {
      if (mode === 'cloud') {
        currentUrl = await promptCloudDbUrl();
        if (!currentUrl) {
          mode = await choose('Pilih metode database lainnya:', [
            { value: 'cloud', label: 'Masukkan link Cloud Database (Neon / Supabase)' },
            { value: 'docker', label: 'Docker Desktop' },
            { value: 'local', label: 'PostgreSQL Lokal' },
            { value: 'exit', label: 'Keluar dari setup' },
          ]);
          if (mode === 'exit') return null;
          continue;
        }
      } else if (mode === 'docker') {
        const res = await promptDockerDbUrl();
        if (res.switchTo === 'cancel') {
          mode = await choose('Pilih metode database:', [
            { value: 'cloud', label: 'Cloud Database Gratis (Neon / Supabase)' },
            { value: 'docker', label: 'Docker Desktop' },
            { value: 'local', label: 'PostgreSQL Lokal' },
          ]);
          continue;
        }
        if (res.switchTo) {
          mode = res.switchTo;
          continue;
        }
        currentUrl = res.url;
      } else if (mode === 'local') {
        currentUrl = await promptLocalPostgresUrl();
      }
    }

    info('Menguji koneksi ke database...');
    const test = await testDatabaseConnection(currentUrl);
    if (test.ok) {
      ok('Berhasil terhubung ke PostgreSQL!');
      envMap.set('DATABASE_URL', currentUrl);
      writeEnvFile(envMap);
      return currentUrl;
    }

    fail(`Koneksi gagal: ${diagnoseDbError(test)}`);
    const fix = await choose('Jangan khawatir — pilih cara mengatasi:', [
      { value: 'retry_input', label: 'Perbaiki / masukkan ulang detail database ini' },
      { value: 'ssl', label: 'Tambahkan mode SSL (?sslmode=require) lalu coba lagi' },
      { value: 'switch_cloud', label: 'Ganti ke Cloud Database Gratis (Neon / Supabase)' },
      { value: 'switch_docker', label: 'Ganti ke Docker Desktop' },
      { value: 'switch_local', label: 'Ganti ke PostgreSQL Lokal' },
      { value: 'abort', label: 'Simpan .env apa adanya & keluar' },
    ]);

    if (fix === 'retry_input') {
      currentUrl = null;
    } else if (fix === 'ssl') {
      currentUrl = ensureSslParam(currentUrl);
    } else if (fix === 'switch_cloud') {
      mode = 'cloud';
      currentUrl = null;
    } else if (fix === 'switch_docker') {
      mode = 'docker';
      currentUrl = null;
    } else if (fix === 'switch_local') {
      mode = 'local';
      currentUrl = null;
    } else {
      if (currentUrl) {
        envMap.set('DATABASE_URL', currentUrl);
        writeEnvFile(envMap);
      }
      return null;
    }
  }
}

async function runMigrations() {
  header('Langkah 4/4 — Membuat Tabel Database (Migrasi)');

  while (true) {
    info('Menjalankan npm run db:migrate...');
    const migrated = await runInherit(NPM_BIN, ['run', 'db:migrate']);
    if (migrated) {
      ok('Semua tabel database berhasil dibuat dan siap digunakan!');
      return true;
    }

    fail('Migrasi database gagal dijalankan.');
    const action = await choose('Pilih langkah pemulihan:', [
      { value: 'retry', label: 'Coba ulang npm run db:migrate' },
      { value: 'reconfig', label: 'Ubah / periksa ulang koneksi database' },
      { value: 'abort', label: 'Keluar dulu' },
    ]);

    if (action === 'reconfig') return 'reconfig';
    if (action === 'abort') return false;
  }
}

async function main() {
  console.log('\n============================================================');
  console.log('   WIZARD INSTALASI LOKAL — UNDANGAN DIGITAL');
  console.log('   Panduan otomatis tanpa perlu konfigurasi manual yang rumit');
  console.log('============================================================');

  const depsOk = await ensureDependencies();
  if (!depsOk) {
    rl.close();
    process.exit(1);
  }

  const envMap = await prepareEnvDefaults();

  while (true) {
    const dbUrl = await configureDatabase(envMap);
    if (!dbUrl) {
      warn('Setup dihentikan sebelum database terhubung. Jalankan lagi "npm run setup" kapan saja.');
      rl.close();
      process.exit(1);
    }

    const mig = await runMigrations();
    if (mig === true) break;
    if (mig === false) {
      rl.close();
      process.exit(1);
    }
    // Jika 'reconfig', ulangi loop configureDatabase
  }

  header('INSTALASI SELESAI & SIAP DIGUNAKAN!');
  console.log('  1. Buka di browser : http://localhost:3000');
  console.log('  2. Daftar akun     : http://localhost:3000/register');
  console.log('     (Akun pertama yang Anda buat otomatis menjadi Administrator)');
  console.log('  3. Untuk update fitur baru di masa depan, cukup buka /admin');
  console.log('     lalu klik "Cek Pembaruan" -> "Sinkronkan Update".\n');

  const startNow = (await ask('Jalankan aplikasi sekarang juga? (Y/n)', 'Y')).toLowerCase();
  rl.close();

  if (startNow === '' || startNow === 'y' || startNow === 'ya' || startNow === 'yes') {
    console.log('\n  Menjalankan server lokal... Tekan Ctrl+C kapan saja untuk menghentikan.\n');
    await runInherit(NPM_BIN, ['run', 'dev']);
  } else {
    console.log('\n  Siap! Nanti tinggal ketik "npm run dev" untuk menyalakan aplikasi.\n');
  }
}

main().catch((err) => {
  fail(err?.message || 'Terjadi kesalahan saat setup.');
  rl.close();
  process.exit(1);
});
