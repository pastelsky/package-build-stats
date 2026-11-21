---
'package-build-stats': patch
---

Use async `zlib.gzip` in `buildPackage` and async `oxc-parser` `parse()` in `getExportsTree` to avoid blocking the Node.js event loop.
