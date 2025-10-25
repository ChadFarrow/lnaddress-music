/**
 * Image URL utilities
 * Handles image URL cleanup and processing
 */

/**
 * Cleans up malformed image URLs
 * Fixes common issues like "?.jpg" endings
 */
export function cleanImageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;

  return url
    .replace(/\?\.jpg$/, '.jpg')
    .replace(/\?\.png$/, '.png')
    .replace(/\?\.jpeg$/, '.jpeg')
    .replace(/\?\.webp$/, '.webp')
    .replace(/\?\.$/, '')
    .replace(/\?$/, '');
}

/**
 * Cleans both album and track images in an object
 * Useful for processing album data with nested track images
 */
export function cleanAlbumImages<T extends {
  image?: string;
  tracks?: Array<{ image?: string }>;
}>(album: T): T {
  return {
    ...album,
    image: cleanImageUrl(album.image),
    tracks: album.tracks?.map(track => ({
      ...track,
      image: cleanImageUrl(track.image),
    })),
  };
}

/**
 * Gets CDN URL for an image if CDN is configured
 * Falls back to original URL if no CDN
 */
export function getCDNImageUrl(
  imageUrl: string | undefined,
  cdnDomain?: string
): string | undefined {
  if (!imageUrl) return imageUrl;
  if (!cdnDomain) return cleanImageUrl(imageUrl);

  try {
    const url = new URL(imageUrl);
    const cleanUrl = cleanImageUrl(imageUrl);

    // Replace domain with CDN domain
    return cleanUrl?.replace(url.origin, `https://${cdnDomain}`);
  } catch {
    // If URL parsing fails, return cleaned original
    return cleanImageUrl(imageUrl);
  }
}
