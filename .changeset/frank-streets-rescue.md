---
'package-build-stats': patch
---

Reduce export compilation batches from 100 to 20 at 75% of a configurable per-worker `memoryLimitBytes` budget (1 GiB by default), retaining larger batches for low-memory analyses and preserving every export measurement.
