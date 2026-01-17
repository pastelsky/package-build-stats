# SCSS Package Fixture

## Purpose

Tests SCSS compilation, CSS extraction, and bundling with sass-loader.

## Package Contents

- `src/index.js` - JavaScript entry that imports SCSS
- `src/styles.scss` - SCSS stylesheet with variables and nesting
- `package.json` - Package configuration

## What It Tests

- ✅ SCSS file imports
- ✅ SCSS compilation (variables, nesting)
- ✅ CSS extraction after compilation
- ✅ CSS minification
- ✅ Multiple asset output (JS + CSS)

## Expected Behavior

When built with rspack:

- **Number of assets:** 2 (main.bundle.js + main.bundle.css)
- **JS size:** ~100-200 bytes
- **CSS size:** ~200-300 bytes (compiled from SCSS)
- **Build time:** <2 seconds (SCSS compilation)
- SCSS should be compiled to CSS and extracted

## Related Tests

- `tests/fixtures.test.ts` - Tests SCSS compilation
