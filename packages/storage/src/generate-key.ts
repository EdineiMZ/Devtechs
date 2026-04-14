import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';

/**
 * Build a canonical storage key for a freshly uploaded file.
 *
 *     generateKey('rh/avatars', 'alice.PNG')
 *     → 'rh/avatars/550e8400-e29b-41d4-a716-446655440000-1712990400000.png'
 *
 * Design notes:
 * - UUID v4 guarantees uniqueness even if multiple services write to
 *   the same folder at the same millisecond.
 * - The timestamp is still included (after the uuid) so operations
 *   teams can grep and sort files by upload time without reaching
 *   for object metadata.
 * - The extension is lower-cased so `foo.PNG` and `foo.png` produce
 *   identical suffixes, which avoids subtle case-sensitivity bugs
 *   between Windows dev boxes and Linux prod buckets.
 * - Slashes in `folder` are preserved (so `rh/avatars/2025` is a valid
 *   folder), but leading/trailing slashes are trimmed. A leading slash
 *   in the final key breaks both R2 and local `path.join`.
 */
export function generateKey(folder: string, filename: string): string {
  const safeFolder = folder.replace(/^\/+|\/+$/g, '');
  const ext = extname(filename).toLowerCase();
  const uuid = randomUUID();
  const timestamp = Date.now();
  const name = `${uuid}-${timestamp}${ext}`;
  return safeFolder ? `${safeFolder}/${name}` : name;
}
