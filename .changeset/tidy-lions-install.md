---
'package-build-stats': minor
---

Allow analysis functions to use an optional package installation service while
retaining local installation as the default and fallback. Remote analyses now
unsubscribe after cleanup so the service can release idle installations.
