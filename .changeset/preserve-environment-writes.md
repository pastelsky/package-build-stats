---
'package-build-stats': patch
---

Preserve assignments to process.env.NODE_ENV while inlining production reads, fixing invalid bundles for packages such as gulp-posthtml.
