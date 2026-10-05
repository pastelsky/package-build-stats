---
'package-build-stats': minor
---

Allow analysis functions to acquire and release installations through an optional
provider. Standalone usage still installs locally; provider failures propagate
instead of silently starting another installation.
