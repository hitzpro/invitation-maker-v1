export const env = (key) => process.env[key] ?? import.meta.env[key];

let validated = false;
export function assertEnv() {
  if (validated) return;
  validated = true;

  if (!env('DATABASE_URL')) {
    console.warn('[env] DATABASE_URL belum diatur.');
  }
  const secret = env('APP_SECRET');
  if (import.meta.env.PROD && (!secret || secret.length < 16)) {
    throw new Error('APP_SECRET wajib diatur minimal 16 karakter di lingkungan produksi');
  }
}