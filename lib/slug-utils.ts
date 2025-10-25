/**
 * Slug generation utilities
 * Creates URL-friendly slugs from text
 */

/**
 * Creates a URL-friendly slug from text
 * Removes special characters, converts spaces to hyphens, lowercases
 */
export function createSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')      // Replace spaces with hyphens
    .replace(/-+/g, '-')       // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, '')   // Remove leading/trailing hyphens
    .trim();
}

/**
 * Creates an album slug from title
 * Alias for createSlug for semantic clarity
 */
export function createAlbumSlug(title: string): string {
  return createSlug(title);
}

/**
 * Creates a track slug from title
 * Alias for createSlug for semantic clarity
 */
export function createTrackSlug(title: string): string {
  return createSlug(title);
}

/**
 * Creates a slug with ID prefix for uniqueness
 * Useful when slug alone might not be unique
 */
export function createSlugWithId(text: string, id: string | number): string {
  const slug = createSlug(text);
  return `${id}-${slug}`;
}

/**
 * Parses a slug-with-id back into parts
 * Returns null if format doesn't match
 */
export function parseSlugWithId(slugWithId: string): { id: string; slug: string } | null {
  const match = slugWithId.match(/^(\d+)-(.+)$/);
  if (!match) return null;

  return {
    id: match[1],
    slug: match[2],
  };
}
