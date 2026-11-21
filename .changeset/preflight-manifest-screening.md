---
'package-build-stats': minor
---

Add a lightweight `package-build-stats/preflight` subpath export (`screenPackageManifest`) to reject spec-guaranteed platform (`os`/`cpu`) and `package.json` `"exports"` failures without loading Rspack or bundler dependencies.
