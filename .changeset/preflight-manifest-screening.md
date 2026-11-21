---
'package-build-stats': minor
---

Add a lightweight `package-build-stats/preflight` subpath export (`screenPackageManifest`) backed by `npm-install-checks` and `resolve.exports` to reject spec-guaranteed platform (`os`/`cpu`/`libc`) and `package.json` `"exports"` failures without loading Rspack or bundler dependencies.
