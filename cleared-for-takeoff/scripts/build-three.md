# Rebuilding `public/vendor/three.min.js`

The Learning Flight Map loads three.js from the app itself (no CDN), so it works offline and under the
strict `script-src 'self'` Content-Security-Policy. The file is a tree-shaken ES-module bundle that
contains only the exports listed in `scripts/three-entry.js`.

When `public/flight-map.js` starts using another three.js class, add it to `three-entry.js` and rebuild:

```bash
mkdir /tmp/three-build && cd /tmp/three-build
npm init -y && npm install three@0.187.0 esbuild
cp <repo>/cleared-for-takeoff/scripts/three-entry.js entry.js
npx esbuild entry.js --bundle --minify --format=esm --target=es2020 --legal-comments=none --outfile=three.min.js
# prepend the licence line and copy into the app
{ printf '/* three.js r187 (subset) — MIT License, Copyright © 2010-2026 three.js authors. See three.LICENSE. */\n'; cat three.min.js; } \
  > <repo>/cleared-for-takeoff/public/vendor/three.min.js
```
