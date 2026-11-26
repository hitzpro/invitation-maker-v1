import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { env } from './env.js';

const execFileAsync = promisify(execFile);
const ROOT_DIR = process.cwd();
const SAFE_REF_RE = /^[a-zA-Z0-9._/-]+$/;
const NPM_BIN = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function readPackageVersion() {
  try {
    const pkg = JSON.parse(readFileSync(resolve(ROOT_DIR, 'package.json'), 'utf8'));
    return pkg.version || '0.0.1';
  } catch {
    return '0.0.1';
  }
}

async function runCmd(bin, args, timeout = 30000) {
  const { stdout, stderr } = await execFileAsync(bin, args, {
    cwd: ROOT_DIR,
    timeout,
    maxBuffer: 1024 * 1024,
  });
  return {
    stdout: String(stdout ?? '').trim(),
    stderr: String(stderr ?? '').trim(),
  };
}

async function getGitContext() {
  try {
    const inside = await runCmd('git', ['rev-parse', '--is-inside-work-tree'], 5000);
    if (inside.stdout !== 'true') {
      return { gitAvailable: false, reason: 'Direktori ini bukan repositori Git.' };
    }
  } catch {
    return {
      gitAvailable: false,
      reason: 'Git tidak tersedia atau proyek tidak di-clone lewat git.',
    };
  }

  let branch = env('UPSTREAM_BRANCH')?.trim() || '';
  if (!branch) {
    try {
      const res = await runCmd('git', ['rev-parse', '--abbrev-ref', 'HEAD'], 5000);
      branch = res.stdout === 'HEAD' ? 'main' : res.stdout;
    } catch {
      branch = 'main';
    }
  }

  if (!SAFE_REF_RE.test(branch)) {
    return { gitAvailable: false, reason: 'Nama branch Git tidak valid.' };
  }

  let localCommit = '';
  let remoteUrl = '';
  let hasLocalChanges = false;

  try {
    localCommit = (await runCmd('git', ['rev-parse', '--short', 'HEAD'], 5000)).stdout;
  } catch {}

  try {
    remoteUrl = (await runCmd('git', ['remote', 'get-url', 'origin'], 5000)).stdout;
  } catch {
    return {
      gitAvailable: false,
      reason: 'Remote "origin" belum dikonfigurasi pada repositori lokal.',
    };
  }

  try {
    const dirty = (await runCmd('git', ['status', '--porcelain', '--untracked-files=no'], 5000)).stdout;
    hasLocalChanges = dirty.length > 0;
  } catch {}

  return {
    gitAvailable: true,
    branch,
    localCommit,
    remoteUrl,
    hasLocalChanges,
  };
}

export async function checkForUpdates() {
  const packageVersion = readPackageVersion();
  const ctx = await getGitContext();

  if (!ctx.gitAvailable) {
    return {
      ok: true,
      gitAvailable: false,
      packageVersion,
      reason: ctx.reason,
      checkedAt: new Date().toISOString(),
    };
  }

  try {
    await runCmd('git', ['fetch', '--quiet', 'origin', ctx.branch], 25000);
  } catch (err) {
    return {
      ok: false,
      gitAvailable: true,
      packageVersion,
      branch: ctx.branch,
      localCommit: ctx.localCommit,
      hasLocalChanges: ctx.hasLocalChanges,
      error: `Gagal menghubungi repositori GitHub: ${err?.message || 'periksa koneksi internet.'}`,
      checkedAt: new Date().toISOString(),
    };
  }

  const targetRef = `origin/${ctx.branch}`;
  let remoteCommit = ctx.localCommit;
  let behindCount = 0;
  let commits = [];

  try {
    remoteCommit = (await runCmd('git', ['rev-parse', '--short', targetRef], 5000)).stdout;
    const countRes = await runCmd('git', ['rev-list', '--count', `HEAD..${targetRef}`], 5000);
    behindCount = Number(countRes.stdout) || 0;

    if (behindCount > 0) {
      const logRes = await runCmd(
        'git',
        ['log', '-n', '8', '--pretty=format:%h\t%s\t%cs', `HEAD..${targetRef}`],
        5000
      );
      commits = logRes.stdout
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [hash, subject, date] = line.split('\t');
          return { hash, subject, date };
        });
    }
  } catch (err) {
    return {
      ok: false,
      gitAvailable: true,
      packageVersion,
      branch: ctx.branch,
      localCommit: ctx.localCommit,
      error: `Gagal membaca status pembaruan: ${err?.message || 'branch remote tidak ditemukan.'}`,
      checkedAt: new Date().toISOString(),
    };
  }

  return {
    ok: true,
    gitAvailable: true,
    packageVersion,
    branch: ctx.branch,
    localCommit: ctx.localCommit,
    remoteCommit,
    behindCount,
    hasUpdates: behindCount > 0,
    hasLocalChanges: ctx.hasLocalChanges,
    commits,
    checkedAt: new Date().toISOString(),
  };
}

export async function applyUpdateSync() {
  const status = await checkForUpdates();
  if (!status.ok) return status;
  if (!status.gitAvailable) {
    return { ok: false, error: status.reason };
  }
  if (status.hasLocalChanges) {
    return {
      ok: false,
      error:
        'Ada perubahan pada file kode lokal yang belum di-commit. Simpan atau kembalikan perubahan agar proses sinkronisasi aman dan tidak menimbulkan konflik.',
    };
  }
  if (!status.hasUpdates) {
    return {
      ok: true,
      updated: false,
      packageVersion: status.packageVersion,
      localCommit: status.localCommit,
      message: 'Aplikasi sudah menggunakan versi terbaru dari repositori.',
    };
  }

  const targetRef = `origin/${status.branch}`;
  let changedFiles = [];
  try {
    const diffRes = await runCmd('git', ['diff', '--name-only', `HEAD..${targetRef}`], 10000);
    changedFiles = diffRes.stdout.split('\n').filter(Boolean);
  } catch {}

  try {
    await runCmd('git', ['pull', '--ff-only', 'origin', status.branch], 45000);
  } catch (err) {
    return {
      ok: false,
      error: `Sinkronisasi Git gagal (fast-forward tidak dapat dilakukan): ${err?.message || 'jalankan git pull secara manual.'}`,
    };
  }

  const needInstall = changedFiles.some(
    (f) => f === 'package.json' || f === 'package-lock.json' || f === 'bun.lock'
  );
  const needMigrate = changedFiles.some((f) => f.startsWith('drizzle/') || f === 'src/db/schema.js');
  const hasProdBuild = existsSync(resolve(ROOT_DIR, 'dist/server/entry.mjs'));

  let ranInstall = false;
  let ranMigrate = false;
  let ranBuild = false;
  const warnings = [];

  if (needInstall) {
    try {
      await runCmd(NPM_BIN, ['install', '--no-audit', '--no-fund'], 120000);
      ranInstall = true;
    } catch (err) {
      warnings.push(`Install dependensi otomatis gagal: ${err?.message}. Jalankan "npm install" di terminal.`);
    }
  }

  if (needMigrate && env('DATABASE_URL')?.trim()) {
    try {
      await runCmd(NPM_BIN, ['run', 'db:migrate'], 60000);
      ranMigrate = true;
    } catch (err) {
      warnings.push(`Migrasi database otomatis gagal: ${err?.message}. Jalankan "npm run db:migrate" di terminal.`);
    }
  }

  if (hasProdBuild) {
    try {
      await runCmd(NPM_BIN, ['run', 'build'], 120000);
      ranBuild = true;
    } catch (err) {
      warnings.push(`Build ulang produksi gagal: ${err?.message}. Jalankan "npm run build" lalu restart server.`);
    }
  }

  const newCommit = (await runCmd('git', ['rev-parse', '--short', 'HEAD'], 5000).catch(() => ({
    stdout: status.remoteCommit,
  }))).stdout;

  return {
    ok: true,
    updated: true,
    previousCommit: status.localCommit,
    newCommit,
    packageVersion: readPackageVersion(),
    commits: status.commits,
    ranInstall,
    ranMigrate,
    ranBuild,
    requiresRestart: hasProdBuild || ranInstall,
    warnings,
    message: hasProdBuild
      ? 'Sinkronisasi selesai. Restart server produksi lalu lakukan Hard Refresh (Ctrl+Shift+R) di browser.'
      : 'Sinkronisasi selesai. Silakan lakukan Hard Refresh (Ctrl+Shift+R / Cmd+Shift+R) di browser Anda.',
  };
}
