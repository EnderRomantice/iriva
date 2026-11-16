/** Household (space) avatar: a small square image set by the Host; otherwise the first letter of the name. */
export const maxAvatarBytes = 200_000;
const pattern = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const magic: Record<string, (b: Uint8Array) => boolean> = {
  png: b => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  jpeg: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  webp: b => String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP',
};

/** Parse and verify a data URL: allowed type, size limit and matching file signature. */
export function parseAvatar(value: unknown): { type: string; bytes: Buffer } | null {
  if (typeof value !== 'string' || value.length > Math.ceil(maxAvatarBytes * 4 / 3) + 40) return null;
  const match = pattern.exec(value); if (!match) return null;
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > maxAvatarBytes || !magic[match[1]](bytes)) return null;
  return { type: `image/${match[1]}`, bytes };
}

/** Versioned URLs so avatars can be cached privately and refresh after a change. */
export const householdAvatarUrl = (updated: unknown) => updated ? `/api/household/avatar?v=${Date.parse(String(updated))}` : null;
export const memberAvatarUrl = (userId: unknown, updated: unknown) => updated ? `/api/profile/avatar?u=${encodeURIComponent(String(userId))}&v=${Date.parse(String(updated))}` : null;
