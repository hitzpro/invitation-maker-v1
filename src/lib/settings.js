import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { appSettings } from '../db/schema.js';

const DEFAULT_APP_NAME = 'Undangan Digital';

export async function getAppName() {
  try {
    const [row] = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, 'app_name'))
      .limit(1);
    return row?.value?.trim() || DEFAULT_APP_NAME;
  } catch {
    return DEFAULT_APP_NAME;
  }
}

export async function setAppName(name) {
  const value = name.trim() || DEFAULT_APP_NAME;
  await db
    .insert(appSettings)
    .values({ key: 'app_name', value })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: new Date() },
    });
  return value;
}

export async function isRegistrationAllowed() {
  try {
    const [row] = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, 'allow_registration'))
      .limit(1);
    return row ? row.value !== 'false' : true; // bawaan: aktif
  } catch {
    return true;
  }
}

export async function setRegistrationAllowed(allowed) {
  const value = allowed ? 'true' : 'false';
  await db
    .insert(appSettings)
    .values({ key: 'allow_registration', value })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: new Date() },
    });
  return allowed;
}