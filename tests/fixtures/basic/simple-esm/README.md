# Simple ESM Fixture

## Purpose

Tests basic ESM (ECMAScript Module) bundling and size calculation with pure module syntax.

## Package Contents

- `src/index.js` - Main entry point with simple exports
- `package.json` - Package configuration with `type: "module"`

## What It Tests

- ✅ Pure ESM module syntax (`export` keyword)
- ✅ Named exports (`hello`, `add`, `VERSION`)
- ✅ Default parameter values
- ✅ Size calculation for simple functions
- ✅ Basic bundle creation without dependencies

## Expected Behavior

When built with rspack:

- **Bundle size:** ~150-250 bytes (minified)
- **Number of assets:** 1 (main.bundle.js)
- **Dependencies:** None
- **Build time:** <1 second

## Related Tests

- `tests/fixtures.test.ts` - Tests this fixture as part of the basic category

## Notes

This is the simplest possible ESM module. It serves as a baseline for more complex scenarios.
No external dependencies, no complex syntax, just pure ES6 exports.
