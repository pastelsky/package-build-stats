---
'package-build-stats': patch
---

Recover confirmed JSX-in-JavaScript parse failures with one compilation retry limited to the affected installed packages; successful ordinary JavaScript builds keep their existing compilation path. Preserve JSX exports during discovery. Reject successful package-manager runs that did not install the requested package so fallback can report the real installation error. Classify unsupported dependency protocols and missing published versions correctly.
