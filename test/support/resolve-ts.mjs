// Test-only resolve hook for `npm test`.
//
// Node's type stripping runs the .ts files as they are, and Node does not add
// an extension to a relative import. The app code is written for Next.js
// (moduleResolution "bundler"), so lib/rss-parser.ts imports './error-utils',
// not './error-utils.ts'. This hook retries such a relative specifier with
// '.ts', then '/index.ts', so a test can import the real modules unchanged.
// The app build never loads this file.
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      const relative = specifier.startsWith('./') || specifier.startsWith('../');
      if (!relative || error?.code !== 'ERR_MODULE_NOT_FOUND' || /\.[cm]?[jt]sx?$/.test(specifier)) throw error;
      for (const suffix of ['.ts', '/index.ts']) {
        try {
          return nextResolve(specifier + suffix, context);
        } catch {
          // try the next suffix
        }
      }
      throw error;
    }
  },
});
