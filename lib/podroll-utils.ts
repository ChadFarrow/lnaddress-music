/**
 * Utility functions for handling podroll data
 */

// URLs to exclude from podroll displays (non-music podcast feeds)
const EXCLUDED_PODROLL_URLS = [
  'https://www.doerfelverse.com/feeds/intothedoerfelverse.xml'
];

/**
 * Filter out excluded URLs from podroll items
 */
export function filterPodrollItems<T extends { url: string }>(podrollItems: T[]): T[] {
  return podrollItems.filter(item => 
    !EXCLUDED_PODROLL_URLS.includes(item.url)
  );
}

/**
 * Check if a URL should be excluded from podrolls
 */
export function isExcludedFromPodroll(url: string): boolean {
  return EXCLUDED_PODROLL_URLS.includes(url);
}

/**
 * Add a new URL to the exclusion list (for runtime filtering)
 */
export function addExcludedUrl(url: string): void {
  if (!EXCLUDED_PODROLL_URLS.includes(url)) {
    EXCLUDED_PODROLL_URLS.push(url);
  }
}

/**
 * Get the list of excluded URLs
 */
export function getExcludedUrls(): string[] {
  return [...EXCLUDED_PODROLL_URLS];
}