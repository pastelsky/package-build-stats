---
'package-build-stats': patch
---

Fix export-size analysis for namespace exports and reserved or non-identifier export names. Exclude defaults from star re-exports, preserve explicit exports, and keep generated build filenames separate from public export names.
