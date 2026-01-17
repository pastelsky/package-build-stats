# Simple CommonJS Fixture

## Purpose

Tests basic CommonJS module bundling and size calculation with traditional module.exports syntax.

## Package Contents

- `src/index.js` - Main entry point with CommonJS exports
- `package.json` - Package configuration (no "type" field, defaults to CommonJS)

## What It Tests

- ✅ CommonJS module syntax (`module.exports`)
- ✅ Object export pattern
- ✅ Function declarations
- ✅ Size calculation for CJS modules
- ✅ Basic bundle creation without dependencies

## Expected Behavior

When built with rspack:

- **Bundle size:** ~180-280 bytes (minified)
- **Number of assets:** 1 (main.bundle.js)
- **Dependencies:** None
- **Build time:** <1 second

## Related Tests

- `tests/fixtures.test.ts` - Tests this fixture as part of the basic category
