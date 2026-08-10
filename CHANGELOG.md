# package-build-stats

## 9.2.2

### Patch Changes

- 7864791: Safely parse missing module errors across Rspack, Webpack, Node, esbuild, and Vite error patterns, throwing BuildError for non-missing-module compilation failures instead of UnexpectedBuildError. Include JSX support in SWC loader rules.
- 5c6924e: Map "package / version not found" errors from npm, yarn (classic + berry), pnpm, and bun to `PackageNotFoundError` (HTTP 404) instead of the generic `InstallError`. Previously only npm `E404` was handled; `ETARGET`, yarn `YN0035`, pnpm `ERR_PNPM_NO_MATCHING_VERSION`/`ERR_PNPM_FETCH_404`, and bun "package not found" errors were all misclassified.

## 9.2.1

### Patch Changes

- b80df42: Support packages that emit auxiliary assets such as WebAssembly files.
- 1ac5bff: Support packages that emit asset modules such as JSON, fonts, and images.

## 9.2.0

### Minor Changes

- b26393f: Add AbortSignal support so callers can cancel package installers and stop package analysis between build phases.

## 9.1.1

### Patch Changes

- de899ec: Build packages that publish TypeScript source files.

## 9.1.0

### Minor Changes

- 2fce8b3: Use Oxc with bounded concurrency to minify Rspack JavaScript bundles.

### Patch Changes

- 319c8e0: Always close the Rspack compiler when compilation fails without producing stats.
- 08cdf8b: Resolve package entry points exposed through the `svelte` export condition.

## 9.0.0

### Major Changes

- 7b90e66: Require Node.js 22 or newer and validate compatibility on Node.js 22 and 24.
  Also harden package installation, errors, CLI compatibility, build isolation,
  and server shutdown.

## 8.4.1

### Patch Changes

- 66b540c: Upgrade the TypeScript, Vitest, Rspack, Prettier, and Oxlint toolchain while preserving package module resolution behavior.
- d91376e: Reduce peak build memory by serializing only the Rspack stats used for package and dependency sizes, and skip source serialization for failed compilations.
- c2ed23f: Skip Rspack module and source serialization when dependency sizes are not requested.

## 8.4.0

### Minor Changes

- 8694d28: Use Oxc with bounded concurrency for faster, lower-memory dependency size minification.

## 8.3.0

### Minor Changes

- de28dfb: Improve package export analysis by handling multi-output chunks and surfacing invalid exports clearly.
