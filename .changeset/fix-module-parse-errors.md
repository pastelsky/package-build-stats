---
'package-build-stats': patch
---

Safely parse missing module errors across Rspack, Webpack, Node, esbuild, and Vite error patterns, throwing BuildError for non-missing-module compilation failures instead of UnexpectedBuildError. Include JSX support in SWC loader rules.
