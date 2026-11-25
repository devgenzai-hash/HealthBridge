/**
 * Storage URL abstraction.
 * MVP: Returns Supabase Storage public URL.
 * v2: Can swap to Cloudflare R2, AWS S3, or custom CDN.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

/**
 * Get a public URL for a file stored in Supabase Storage.
 * @param bucket - The storage bucket name (e.g., 'reports', 'prescriptions')
 * @param path - The file path within the bucket
 * @returns Full public URL to the file
 */
export function getFileUrl(bucket: string, path: string): string {
  if (!path) return ''
  // If already a full URL, return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`
}

/**
 * Get a signed URL for private file access.
 * v2: Can integrate with CDN signed URLs.
 */
export function getSignedFileUrl(bucket: string, path: string, expiresIn = 3600): string {
  // For MVP, return public URL (RLS handles access control on storage)
  return getFileUrl(bucket, path)
}
