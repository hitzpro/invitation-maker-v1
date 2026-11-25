import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { env } from './env.js';

export const ALLOWED_MIME = new Set(['image/jpeg', 'image/png']);
export const MAX_ASSETS_PER_INVITATION = 30;
const MAX_DIMENSION = 2000;

export const FILENAME_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

export const getUploadDir = () => path.resolve(env('UPLOAD_DIR') ?? './uploads');
export const getCacheDir = () => path.join(path.dirname(getUploadDir()), 'cache');
export const getMaxUploadBytes = () => (Number(env('MAX_UPLOAD_SIZE_MB')) || 20) * 1024 * 1024;

export class UploadError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// Cek file signature (magic bytes), bukan hanya ekstensi / MIME dari browser
function detectType(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length >= 8 && png.every((b, i) => buf[i] === b)) return 'image/png';
  return null;
}

export async function processImageUpload(file) {
  if (!(file instanceof File) || file.size === 0) {
    throw new UploadError('File tidak ditemukan');
  }
  if (file.size > getMaxUploadBytes()) {
    throw new UploadError(`Ukuran file maksimal ${getMaxUploadBytes() / 1024 / 1024} MB`, 413);
  }
  if (!ALLOWED_MIME.has(file.type)) {
    throw new UploadError('Format harus JPEG, JPG, atau PNG', 415);
  }

  const input = Buffer.from(await file.arrayBuffer());
  const detected = detectType(input);
  if (!detected || detected !== file.type) {
    throw new UploadError('Isi file tidak sesuai dengan format gambar yang diizinkan', 415);
  }

  let output, info;
  try {
    ({ data: output, info } = await sharp(input, { limitInputPixels: 50_000_000 })
      .rotate() // terapkan orientasi EXIF; metadata lain dibuang
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true }));
  } catch {
    throw new UploadError('File gambar rusak atau tidak dapat diproses', 422);
  }

  const filename = `${randomUUID()}.webp`;
  const dir = getUploadDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), output, { flag: 'wx' });

  return {
    filename,
    mimeType: 'image/webp',
    sizeBytes: info.size,
    width: info.width,
    height: info.height,
  };
}

export async function removeFiles(filenames) {
  const dir = getUploadDir();
  await Promise.all(
    filenames
      .filter((name) => FILENAME_RE.test(name) || AUDIO_FILENAME_RE.test(name))
      .map((name) => unlink(path.join(dir, name)).catch(() => {}))
  );
}

export const AUDIO_FILENAME_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp3|m4a|ogg)$/;
export const MAX_AUDIO_PER_INVITATION = 5;
export const getMaxAudioBytes = () => (Number(env('MAX_AUDIO_SIZE_MB')) || 10) * 1024 * 1024;

// Cek file signature (magic bytes), bukan ekstensi atau MIME dari browser
function detectAudio(buf) {
  if (buf.length >= 3 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    return { ext: 'mp3', mime: 'audio/mpeg' }; // tag ID3
  }
  if (buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) {
    return { ext: 'mp3', mime: 'audio/mpeg' }; // frame MP3
  }
  if (buf.length >= 12 && buf.toString('latin1', 4, 8) === 'ftyp') {
    return { ext: 'm4a', mime: 'audio/mp4' };
  }
  if (buf.length >= 4 && buf.toString('latin1', 0, 4) === 'OggS') {
    return { ext: 'ogg', mime: 'audio/ogg' };
  }
  return null;
}

export async function processAudioUpload(file) {
  if (!(file instanceof File) || file.size === 0) throw new UploadError('File tidak ditemukan');
  if (file.size > getMaxAudioBytes()) {
    throw new UploadError(`Ukuran file maksimal ${getMaxAudioBytes() / 1024 / 1024} MB`, 413);
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const type = detectAudio(buf);
  if (!type) throw new UploadError('Format harus MP3, M4A, atau OGG', 415);

  const filename = `${randomUUID()}.${type.ext}`;
  const dir = getUploadDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buf, { flag: 'wx' });

  return { filename, mimeType: type.mime, sizeBytes: buf.length };
}