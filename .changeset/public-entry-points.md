---
'package-build-stats': minor
---

Add `getPackageEntryPoints` to discover concrete public browser entry points without building bundles, including wildcard expansion, exclusions, and legacy deep imports. Support an `entryPoint` option for package sizes, named exports, and export sizes. Resolve public export maps with browser ESM conditions consistently, and reject missing entry points rather than treating them as optional dependencies.
