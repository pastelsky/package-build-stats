---
'package-build-stats': patch
---

Add native binary addon asset rules (`.node`, `.exe`, `.dll`, `.so`, `.dylib`, `.wasm`) to Rspack loader configuration. Prevents JavaScript syntax parse errors (`Unexpected character '\u{7f}'` / `Unexpected character '\0'`) when packages ship compiled native binaries.
