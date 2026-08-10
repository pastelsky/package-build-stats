---
'package-build-stats': patch
---

Map "package / version not found" errors from npm, yarn (classic + berry), pnpm, and bun to `PackageNotFoundError` (HTTP 404) instead of the generic `InstallError`. Previously only npm `E404` was handled; `ETARGET`, yarn `YN0035`, pnpm `ERR_PNPM_NO_MATCHING_VERSION`/`ERR_PNPM_FETCH_404`, and bun "package not found" errors were all misclassified.
