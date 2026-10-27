---
'package-build-stats': patch
---

Reject successful package-manager runs that did not install the requested package so the existing fallback can report the real installation error. Classify unsupported dependency protocols and missing published versions correctly.
