---
'package-build-stats': patch
---

Limit generated-asset reads and gzip measurements to four concurrent tasks across overlapping analyses to reduce peak buffer memory.
