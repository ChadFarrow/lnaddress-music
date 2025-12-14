import fs from 'fs';
import path from 'path';

export interface CachedRSSData {
  data: any;
  lastFetched: string;
  url: string;
  etag?: string;
}

export interface RSSCacheEntry {
  [feedUrl: string]: CachedRSSData;
}

// In-memory cache for Vercel (read-only filesystem)
const memoryCache = new Map<string, CachedRSSData>();

export class RSSCache {
  private static readonly CACHE_DIR = path.join(process.cwd(), 'data', 'rss-cache');
  private static readonly CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

  // Check if running on Vercel (read-only filesystem)
  private static isVercel(): boolean {
    return !!process.env.VERCEL;
  }

  static ensureCacheDir() {
    if (this.isVercel()) return; // Skip on Vercel
    try {
      if (!fs.existsSync(this.CACHE_DIR)) {
        fs.mkdirSync(this.CACHE_DIR, { recursive: true });
      }
    } catch {
      // Silently fail - filesystem may be read-only
    }
  }

  static getCacheFilePath(feedUrl: string): string {
    // Create a safe filename from the URL
    const hash = Buffer.from(feedUrl).toString('base64')
      .replace(/[/+=]/g, '_');
    return path.join(this.CACHE_DIR, `${hash}.json`);
  }

  static get(feedUrl: string): CachedRSSData | null {
    try {
      // Use in-memory cache on Vercel
      if (this.isVercel()) {
        const cached = memoryCache.get(feedUrl);
        if (!cached) return null;

        const age = Date.now() - new Date(cached.lastFetched).getTime();
        if (age < this.CACHE_DURATION_MS) {
          return cached;
        } else {
          memoryCache.delete(feedUrl);
          return null;
        }
      }

      this.ensureCacheDir();
      const cacheFile = this.getCacheFilePath(feedUrl);

      if (!fs.existsSync(cacheFile)) {
        return null;
      }

      const cacheData: CachedRSSData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      const age = Date.now() - new Date(cacheData.lastFetched).getTime();

      // Check if cache is still valid
      if (age < this.CACHE_DURATION_MS) {
        console.log(`📦 Using cached RSS data for: ${feedUrl} (age: ${Math.round(age / 1000 / 60)}min)`);
        return cacheData;
      } else {
        console.log(`⏰ Cache expired for: ${feedUrl} (age: ${Math.round(age / 1000 / 60)}min)`);
        // Delete expired cache
        fs.unlinkSync(cacheFile);
        return null;
      }
    } catch (error) {
      // Don't log errors on Vercel - expected behavior
      if (!this.isVercel()) {
        console.error(`❌ Error reading cache for ${feedUrl}:`, error);
      }
      return null;
    }
  }

  static set(feedUrl: string, data: any, etag?: string): void {
    const cacheData: CachedRSSData = {
      data,
      lastFetched: new Date().toISOString(),
      url: feedUrl,
      etag
    };

    // Use in-memory cache on Vercel
    if (this.isVercel()) {
      memoryCache.set(feedUrl, cacheData);
      return;
    }

    try {
      this.ensureCacheDir();
      const cacheFile = this.getCacheFilePath(feedUrl);
      fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
      console.log(`💾 Cached RSS data for: ${feedUrl}`);
    } catch (error) {
      // Silently fail - filesystem may be read-only
      // Fall back to in-memory cache
      memoryCache.set(feedUrl, cacheData);
    }
  }

  static clear(feedUrl?: string): void {
    // Clear in-memory cache
    if (feedUrl) {
      memoryCache.delete(feedUrl);
    } else {
      memoryCache.clear();
    }

    // Skip file operations on Vercel
    if (this.isVercel()) return;

    try {
      this.ensureCacheDir();

      if (feedUrl) {
        // Clear specific feed cache
        const cacheFile = this.getCacheFilePath(feedUrl);
        if (fs.existsSync(cacheFile)) {
          fs.unlinkSync(cacheFile);
          console.log(`🗑️ Cleared cache for: ${feedUrl}`);
        }
      } else {
        // Clear all cache files
        const files = fs.readdirSync(this.CACHE_DIR);
        for (const file of files) {
          if (file.endsWith('.json')) {
            fs.unlinkSync(path.join(this.CACHE_DIR, file));
          }
        }
        console.log(`🗑️ Cleared all RSS cache files (${files.length} files)`);
      }
    } catch (error) {
      // Silently fail on read-only filesystem
    }
  }

  static getCacheStats(): { totalFiles: number; totalSize: number; oldestCache?: string; newestCache?: string; inMemory?: number } {
    // On Vercel, return in-memory cache stats
    if (this.isVercel()) {
      return {
        totalFiles: 0,
        totalSize: 0,
        inMemory: memoryCache.size
      };
    }

    try {
      this.ensureCacheDir();
      const files = fs.readdirSync(this.CACHE_DIR).filter(f => f.endsWith('.json'));

      let totalSize = 0;
      let oldestTime = Date.now();
      let newestTime = 0;
      let oldestFile = '';
      let newestFile = '';

      for (const file of files) {
        const filePath = path.join(this.CACHE_DIR, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;

        if (stats.mtime.getTime() < oldestTime) {
          oldestTime = stats.mtime.getTime();
          oldestFile = file;
        }

        if (stats.mtime.getTime() > newestTime) {
          newestTime = stats.mtime.getTime();
          newestFile = file;
        }
      }

      return {
        totalFiles: files.length,
        totalSize,
        oldestCache: oldestFile ? new Date(oldestTime).toISOString() : undefined,
        newestCache: newestFile ? new Date(newestTime).toISOString() : undefined,
        inMemory: memoryCache.size
      };
    } catch (error) {
      return { totalFiles: 0, totalSize: 0, inMemory: memoryCache.size };
    }
  }
}