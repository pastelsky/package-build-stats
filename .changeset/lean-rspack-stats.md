---
'package-build-stats': patch
---

Reduce peak build memory by serializing only the Rspack stats used for package and dependency sizes, and skip source serialization for failed compilations.
