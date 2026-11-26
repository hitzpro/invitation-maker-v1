import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, isMockDb } from '../db/index.js';
import { appSettings, projectTelemetry } from '../db/schema.js';
import { env } from './env.js';

const TELEMETRY_FILE = process.env.VERCEL
  ? path.join(tmpdir(), 'undangan-telemetry.json')
  : path.resolve(process.cwd(), 'data/telemetry.json');
const INSTANCE_SETTING_KEY = 'telemetry_instance_id';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

let memoryStore = new Map();
let memoryHydrated = false;
let lastPingSentAt = 0;
let cachedInstanceId = null;
let tableReady = false;
let ensureTablePromise = null;

async function ensureTelemetryTable() {
  if (isMockDb || tableReady) return true;
  if (!ensureTablePromise) {
    ensureTablePromise = db
      .execute(sql`
        CREATE TABLE IF NOT EXISTS "project_telemetry" (
          "instance_id" text PRIMARY KEY NOT NULL,
          "version" text DEFAULT '0.0.1' NOT NULL,
          "os" text DEFAULT 'unknown' NOT NULL,
          "node_version" text DEFAULT '' NOT NULL,
          "mode" text DEFAULT 'local' NOT NULL,
          "ping_count" integer DEFAULT 1 NOT NULL,
          "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
          "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
        );
      `)
      .then(() => {
        tableReady = true;
        return true;
      })
      .catch((err) => {
        console.error('[telemetry] Gagal memastikan tabel project_telemetry:', err?.message || err);
        ensureTablePromise = null;
        return false;
      });
  }
  return ensureTablePromise;
}

export const telemetryPingSchema = z.object({
  instanceId: z.string().uuid('instanceId tidak valid'),
  version: z.string().trim().min(1).max(24).default('0.0.1'),
  os: z.string().trim().min(1).max(24).default('unknown'),
  nodeVersion: z.string().trim().max(24).default(''),
  mode: z.enum(['local', 'demo']).default('local'),
});

function hydrateFileStore() {
  if (memoryHydrated) return;
  memoryHydrated = true;
  try {
    if (!existsSync(TELEMETRY_FILE)) return;
    const arr = JSON.parse(readFileSync(TELEMETRY_FILE, 'utf8'));
    if (!Array.isArray(arr)) return;
    for (const item of arr) {
      if (item?.instanceId) {
        memoryStore.set(item.instanceId, {
          ...item,
          firstSeenAt: new Date(item.firstSeenAt || Date.now()),
          lastSeenAt: new Date(item.lastSeenAt || Date.now()),
        });
      }
    }
  } catch {}
}

function persistFileStore() {
  try {
    mkdirSync(path.dirname(TELEMETRY_FILE), { recursive: true });
    writeFileSync(TELEMETRY_FILE, JSON.stringify([...memoryStore.values()], null, 2), 'utf8');
  } catch {}
}

export async function recordTelemetryPing(input) {
  const now = new Date();
  if (!isMockDb) {
    try {
      await ensureTelemetryTable();
      await db
        .insert(projectTelemetry)
        .values({
          instanceId: input.instanceId,
          version: input.version,
          os: input.os,
          nodeVersion: input.nodeVersion,
          mode: input.mode,
          pingCount: 1,
          firstSeenAt: now,
          lastSeenAt: now,
        })
        .onConflictDoUpdate({
          target: projectTelemetry.instanceId,
          set: {
            version: input.version,
            os: input.os,
            nodeVersion: input.nodeVersion,
            mode: input.mode,
            pingCount: sql`${projectTelemetry.pingCount} + 1`,
            lastSeenAt: now,
          },
        });
      return true;
    } catch (err) {
      console.error('[telemetry] Gagal menyimpan ping:', err?.message || err);
      return false;
    }
  }

  hydrateFileStore();
  const prev = memoryStore.get(input.instanceId);
  memoryStore.set(input.instanceId, {
    instanceId: input.instanceId,
    version: input.version,
    os: input.os,
    nodeVersion: input.nodeVersion,
    mode: input.mode,
    pingCount: (prev?.pingCount || 0) + 1,
    firstSeenAt: prev?.firstSeenAt || now,
    lastSeenAt: now,
  });
  persistFileStore();
  return true;
}

export async function getTelemetrySummary() {
  let rows = [];
  let migrationPending = false;
  if (!isMockDb) {
    try {
      await ensureTelemetryTable();
      rows = await db
        .select()
        .from(projectTelemetry)
        .orderBy(desc(projectTelemetry.lastSeenAt))
        .limit(100);
    } catch (err) {
      console.error('[telemetry] Gagal membaca tabel project_telemetry:', err?.message || err);
      migrationPending = true;
      rows = [];
    }
  } else {
    hydrateFileStore();
    rows = [...memoryStore.values()].sort(
      (a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime()
    );
  }

  const now = Date.now();
  const activeLast7Days = rows.filter((r) => now - new Date(r.lastSeenAt).getTime() <= 7 * ONE_DAY_MS).length;
  const activeLast30Days = rows.filter((r) => now - new Date(r.lastSeenAt).getTime() <= 30 * ONE_DAY_MS).length;
  const totalPings = rows.reduce((sum, r) => sum + (Number(r.pingCount) || 1), 0);

  const osMap = new Map();
  const verMap = new Map();
  for (const r of rows) {
    osMap.set(r.os || 'unknown', (osMap.get(r.os || 'unknown') || 0) + 1);
    verMap.set(r.version || '0.0.1', (verMap.get(r.version || '0.0.1') || 0) + 1);
  }

  return {
    migrationPending,
    totalInstances: rows.length,
    activeLast7Days,
    activeLast30Days,
    totalPings,
    osBreakdown: [...osMap.entries()].map(([name, count]) => ({ name, count })),
    versionBreakdown: [...verMap.entries()].map(([name, count]) => ({ name, count })),
    recentInstances: rows.slice(0, 20).map((r) => ({
      shortId: `inst-${String(r.instanceId).slice(0, 8)}`,
      version: r.version,
      os: r.os,
      nodeVersion: r.nodeVersion,
      mode: r.mode,
      pingCount: r.pingCount,
      firstSeenAt: r.firstSeenAt,
      lastSeenAt: r.lastSeenAt,
    })),
  };
}

function isSafeTelemetryEndpoint(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host === '169.254.169.254' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.') ||
      host.startsWith('fe80:') ||
      host.startsWith('fc') ||
      host.startsWith('fd') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function getOrCreateInstanceId() {
  if (cachedInstanceId) return cachedInstanceId;
  if (!isMockDb) {
    try {
      const [row] = await db
        .select({ value: appSettings.value })
        .from(appSettings)
        .where(eq(appSettings.key, INSTANCE_SETTING_KEY))
        .limit(1);
      if (row?.value) {
        cachedInstanceId = row.value;
        return cachedInstanceId;
      }
      const nextId = randomUUID();
      await db
        .insert(appSettings)
        .values({ key: INSTANCE_SETTING_KEY, value: nextId })
        .onConflictDoUpdate({ target: appSettings.key, set: { value: nextId, updatedAt: new Date() } });
      cachedInstanceId = nextId;
      return nextId;
    } catch {}
  }
  cachedInstanceId = randomUUID();
  return cachedInstanceId;
}

function readLocalAppVersion() {
  try {
    const pkg = JSON.parse(readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'));
    return String(pkg.version || '0.0.1').slice(0, 24);
  } catch {
    return '0.0.1';
  }
}

export function maybeSendLocalTelemetryPing(demoMode) {
  if (demoMode) return;
  if (env('DISABLE_TELEMETRY')?.trim().toLowerCase() === 'true') return;

  const endpointBase = env('CREATOR_TELEMETRY_URL')?.trim();
  if (!endpointBase || !isSafeTelemetryEndpoint(endpointBase)) return;

  const now = Date.now();
  if (now - lastPingSentAt < ONE_DAY_MS) return;
  lastPingSentAt = now;

  // Jalankan di background tanpa memblokir request pengguna
  void (async () => {
    try {
      const instanceId = await getOrCreateInstanceId();
      const target = `${endpointBase.replace(/\/+$/, '')}/api/telemetry/ping`;
      await fetch(target, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          instanceId,
          version: readLocalAppVersion(),
          os: process.platform,
          nodeVersion: process.versions.node.split('.')[0],
          mode: 'local',
        }),
        signal: AbortSignal.timeout(3500),
      });
    } catch {
      // Abaikan diam-diam bila offline atau endpoint tidak dapat dijangkau
    }
  })();
}
