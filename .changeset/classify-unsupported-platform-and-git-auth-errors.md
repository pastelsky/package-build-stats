---
'package-build-stats': patch
---

Map platform architecture mismatches (`EBADPLATFORM`, `Unsupported platform`) and private Git SSH authentication failures (`Permission denied (publickey)`) to `UnsupportedPackageError` (HTTP 422) instead of generic `InstallError` (HTTP 500).
