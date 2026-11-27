/**
 * The one User-Agent for every request that this app's server code and scripts
 * send to another host (Chad, 2026-11-27: "I wanna make sure all of my apps are
 * sending proper user agents"):
 *
 *   lnaddress-music/<package.json version> (+https://lnaddress-music.vercel.app)
 *
 * The app's own name, its version and a public link to it. No e-mail, and no
 * browser imitation: until 2026-11-27 the feed parser and the image proxy sent
 * `Mozilla/5.0 (compatible; RSS Parser/1.0)` and `Mozilla/5.0 (compatible;
 * PodtardsImageProxy/1.0)`, the video proxy `DoerfelVerse/1.0 (Video Proxy)`
 * (names copied with the code from other apps), the Podcast Index calls a bare
 * `lnaddress-music-app` or `lnaddress-music-cron`, and some fetches Node's
 * `node` (or, for `https.get`, no User-Agent at all). Each host that a call site
 * reaches was probed with the old and the new name on 2026-11-27; none answered
 * differently.
 *
 * A fork of this template sends this name and link until it edits this file.
 *
 * Use it in every server-side request: route handlers, `lib/` server code and
 * scripts. Browser code cannot set this header, so client fetches keep the
 * browser's own. `test/user-agent.test.ts` asserts the form and refuses any
 * other User-Agent literal in `app/`, `lib/`, `scripts/` and `utils/`.
 *
 * CommonJS on purpose: the Next server build, `npm test` and the scripts all
 * load it. Import it as `./user-agent.js` from `lib/`: `npm test` runs the .ts
 * files under Node, which needs the extension. Server and scripts only: it reads
 * package.json, so nothing in a browser bundle may import it.
 */
const { version } = require('../package.json');

const APP_NAME = 'lnaddress-music';
const APP_URL = 'https://lnaddress-music.vercel.app';
const APP_VERSION = version;
const USER_AGENT = `${APP_NAME}/${APP_VERSION} (+${APP_URL})`;

module.exports = { APP_NAME, APP_URL, APP_VERSION, USER_AGENT };
