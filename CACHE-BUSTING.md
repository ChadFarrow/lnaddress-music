# Cache Busting Guide for Local Development

Browser caching can be frustrating during development. This guide provides multiple solutions to help you bypass caching issues.

## Quick Solutions

### 1. **Enable DEV_MODE (Recommended for Development)**

In `public/sw.js`, set `DEV_MODE` to `true`:

```javascript
const DEV_MODE = true; // <-- Set to false for production
```

This disables all service worker caching and forces fresh network requests. **Remember to set this back to `false` before deploying to production!**

### 2. **Use the Clear Cache Utility Page**

Visit `http://localhost:3000/clear-cache.html` in your browser to access a visual utility that can:
- Clear service worker caches
- Unregister service workers
- Clear all browser storage
- Show current cache status

### 3. **Run the Cache Clear Script**

```bash
npm run clear-cache
```

This increments the `CACHE_VERSION` in your service worker, forcing browsers to download fresh content.

### 4. **Manual Cache Version Bump**

In `public/sw.js`, manually increment the version number:

```javascript
const CACHE_VERSION = 'v2'; // Change v2 → v3, v4, etc.
```

## Browser DevTools Methods

### Chrome/Edge
1. Open DevTools (F12)
2. Go to **Application** tab
3. Click **Clear storage** in the left sidebar
4. Check all boxes and click **Clear site data**

Or for service workers specifically:
1. Go to **Application** → **Service Workers**
2. Click **Unregister** next to the service worker
3. Check **Update on reload**

### Firefox
1. Open DevTools (F12)
2. Go to **Storage** tab
3. Right-click on any storage item
4. Select **Clear All**

### Hard Reload
- **Windows/Linux**: `Ctrl + Shift + R` or `Ctrl + F5`
- **Mac**: `Cmd + Shift + R`

## Testing Cache Behavior

### Check What's Cached
```javascript
// Run in browser console
caches.keys().then(keys => console.log('Cache keys:', keys));
caches.open('music-site-v2').then(cache =>
  cache.keys().then(requests =>
    console.log('Cached URLs:', requests.map(r => r.url))
  )
);
```

### Check Service Worker Status
```javascript
// Run in browser console
navigator.serviceWorker.getRegistrations().then(regs =>
  console.log('Service Workers:', regs)
);
```

## Production Considerations

Before deploying to production:

1. **Set DEV_MODE to false** in `public/sw.js`:
   ```javascript
   const DEV_MODE = false;
   ```

2. **Bump CACHE_VERSION** to ensure users get fresh content:
   ```javascript
   const CACHE_VERSION = 'v3'; // or whatever the next version is
   ```

3. **Test the production build locally**:
   ```bash
   npm run build
   npm start
   ```

## Troubleshooting

### Cache still not updating?
1. Close **all** browser tabs for your site
2. Run `npm run clear-cache`
3. Restart your dev server (`npm run dev`)
4. Open site in a new incognito/private window
5. Hard reload with `Ctrl + Shift + R`

### Service worker won't update?
1. Visit `chrome://serviceworker-internals/` (Chrome)
2. Find your service worker and click **Unregister**
3. Visit `http://localhost:3000/clear-cache.html` and click "Unregister Service Worker"

### Changes still not showing?
1. Enable DEV_MODE in `public/sw.js`
2. Clear all browser storage via DevTools
3. Restart your browser completely
4. Try a different browser to verify it's a caching issue

## Additional Tips

- **Use Incognito Mode**: Great for testing without cache interference
- **Disable Cache in DevTools**: Check "Disable cache" in Network tab (only works while DevTools is open)
- **Check next.config.js**: The service worker is currently disabled via `disable: true`
- **Monitor Network Tab**: Use DevTools Network tab to verify if resources are from cache (look for "disk cache" or "memory cache")

## Cache Strategy Overview

Current caching strategies in `public/sw.js`:
- **Images**: NetworkFirst with 1-day expiration
- **RSS Feeds**: NetworkFirst with 1-hour expiration
- **Audio Files**: NetworkFirst with 24-hour expiration
- **Next.js files**: NetworkFirst with 1-hour expiration

When `DEV_MODE = true`, all of these are bypassed and network is always used first.
