# CSS-Only Fixture

## Purpose

Tests CSS extraction, minification, and bundling with rspack's CSS handling.

## Package Contents

- `src/index.js` - JavaScript entry that imports CSS
- `src/styles.css` - CSS stylesheet
- `package.json` - Package configuration

## What It Tests

- ✅ CSS file imports
- ✅ CSS extraction to separate file
- ✅ CSS minification
- ✅ Multiple asset output (JS + CSS)
- ✅ CSS size calculation

## Expected Behavior

When built with rspack:

- **Number of assets:** 2 (main.bundle.js + main.bundle.css)
- **JS size:** ~100-200 bytes
- **CSS size:** ~150-250 bytes
- **Build time:** <1 second
- CSS should be extracted to separate bundle

## Related Tests

- `tests/fixtures.test.ts` - Tests CSS extraction
