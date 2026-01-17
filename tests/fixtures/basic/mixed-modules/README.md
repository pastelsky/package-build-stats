# Mixed Modules Fixture

## Purpose

Tests packages that use both CommonJS and ESM modules together, verifying that rspack can handle mixed module systems.

## Package Contents

- `src/index.js` - CommonJS main entry that imports from both systems
- `src/math-cjs.js` - CommonJS utility module
- `src/math-esm.mjs` - ESM utility module (`.mjs` extension)
- `package.json` - Package configuration

## What It Tests

- ✅ Mixed CommonJS and ESM in same package
- ✅ `require()` and `import` interop
- ✅ `.mjs` extension handling
- ✅ Cross-module system imports
- ✅ Bundling of mixed module types

## Expected Behavior

When built with rspack:

- **Bundle size:** ~250-350 bytes (minified)
- **Number of assets:** 1 (main.bundle.js)
- **Dependencies:** None
- **Build time:** <1 second
- Should successfully bundle both module types into one output

## Related Tests

- `tests/fixtures.test.ts` - Tests mixed module handling
