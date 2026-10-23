---
'package-build-stats': patch
---

Keep isolated build output under the existing packages workspace tree so host cleanup can reclaim directories abandoned by terminated workers.

Allow `BUILD_TMP_DIR` to select the scratch root for isolated environments and host cleanup verification.
