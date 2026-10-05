import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY tidak ada di environment');
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey);

const BUCKET = 'shift-photos';

/**
 * Upload file ke Supabase Storage bucket `shift-photos`.
 * Path format: {branch_id}/{shift_id}/{photo_id}.webp
 */
export async function uploadFile(
  path: string,
  buffer: Buffer,
  contentType = 'image/webp'
): Promise<string> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType,
    upsert: false,
  });

  if (error) {
    throw new Error(`Upload gagal: ${error.message}`);
  }

  return path;
}

/**
 * Get signed URL untuk akses file (TTL default 1 jam).
 */
export async function getSignedUrl(
  path: string,
  ttlSeconds = 3600
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, ttlSeconds);

  if (error) {
    throw new Error(`Gagal buat signed URL: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * Hapus file dari Supabase Storage.
 */
export async function deleteFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);

  if (error) {
    throw new Error(`Hapus file gagal: ${error.message}`);
  }
}

/**
 * Cek apakah file exists di storage.
 */
export async function fileExists(path: string): Promise<boolean> {
  const { data, error } = await supabase.storage.from(BUCKET).list(path.split('/').slice(0, -1).join('/'), {
    limit: 1,
    search: path.split('/').pop(),
  });

  if (error) return false;
  return data.length > 0;
}
