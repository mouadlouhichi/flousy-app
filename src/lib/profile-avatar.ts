/**
 * Profile-avatar helpers shared by the profile editor and the small avatars in
 * the dashboard chrome. Images are kept deliberately small because custom
 * photos are stored on the user's Firestore profile (rather than requiring a
 * separate Storage setup).
 */

const ACCEPTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const AVATAR_EDGE = 256;
const MAX_DATA_URL_LENGTH = 140_000;

/** Only render sources that are safe for an image element and can be persisted. */
export function isProfileAvatarSource(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const source = value.trim();
  return (
    /^https:\/\/.+/i.test(source) ||
    /^data:image\/(?:jpeg|jpg|png|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(source)
  );
}

/** Prefer a saved profile image, falling back to the identity-provider photo. */
export function resolveProfileAvatarSource(
  savedAvatarUrl?: string | null,
  authPhotoUrl?: string | null,
): string | undefined {
  if (isProfileAvatarSource(savedAvatarUrl)) return savedAvatarUrl.trim();
  if (isProfileAvatarSource(authPhotoUrl)) return authPhotoUrl.trim();
  return undefined;
}

export function looksLikeImageFile(file: File): boolean {
  if (ACCEPTED_IMAGE_TYPES.has(file.type.toLowerCase())) return true;
  // Some mobile browsers (especially iOS camera rolls) omit MIME type.
  if (!file.type) return /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name);
  return file.type.startsWith('image/');
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The selected image could not be read.'));
    image.src = source;
  });
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('The selected image could not be read.'));
    };
    reader.onerror = () => reject(new Error('The selected image could not be read.'));
    reader.readAsDataURL(file);
  });
}

function avatarDataUrl(image: CanvasImageSource, width: number, height: number, edge: number, quality: number): string {
  if (!width || !height) throw new Error('The selected image has no usable dimensions.');

  const sourceEdge = Math.min(width, height);
  const sourceX = (width - sourceEdge) / 2;
  const sourceY = (height - sourceEdge) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = edge;
  canvas.height = edge;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser could not prepare this image.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, edge, edge);
  context.drawImage(image, sourceX, sourceY, sourceEdge, sourceEdge, 0, 0, edge, edge);
  return canvas.toDataURL('image/jpeg', quality);
}

/** Decodes an uploaded file into a drawable image plus its intrinsic size. */
export async function sourceFromFile(file: File): Promise<{ image: CanvasImageSource; width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return { image: bitmap, width: bitmap.width, height: bitmap.height };
    } catch {
      /* HEIC / some Android cameras fall through to FileReader */
    }
  }
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(dataUrl);
  return { image, width: image.naturalWidth || image.width, height: image.naturalHeight || image.height };
}

/**
 * Turns an uploaded image into a small, square JPEG data URL. The retry sizes
 * keep the profile document comfortably below Firestore's 1 MiB document cap
 * while still producing a crisp avatar on high-density displays.
 */
export async function createProfileAvatarDataUrl(file: File): Promise<string> {
  if (!looksLikeImageFile(file)) {
    throw new Error('Choose a JPG, PNG, WebP, or GIF image.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('Choose an image smaller than 12 MB.');
  }
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Profile images can only be prepared in a browser.');
  }

  const { image, width, height } = await sourceFromFile(file);
  const attempts: Array<[edge: number, quality: number]> = [
    [AVATAR_EDGE, 0.78],
    [192, 0.7],
    [160, 0.62],
    [128, 0.55],
    [96, 0.5],
  ];

  let result = '';
  for (const [edge, quality] of attempts) {
    result = avatarDataUrl(image, width, height, edge, quality);
    if (result.length <= MAX_DATA_URL_LENGTH) return result;
  }
  throw new Error('This image could not be compressed enough. Please choose another photo.');
}
