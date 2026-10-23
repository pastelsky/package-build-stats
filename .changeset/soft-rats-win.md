---
'package-build-stats': patch
---

Stop package-manager fallback on ENOSPC or no-space-left errors. Trying another installer cannot recover exhausted disk space or inodes.
