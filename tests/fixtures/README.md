# Test Fixtures

This directory contains test fixtures for the package-build-stats test suite. Fixtures are minimal, self-contained packages that test specific functionality without requiring network access or npm installs.

## Why Fixtures?

1. **Speed:** Tests run in milliseconds instead of minutes
2. **Reliability:** Deterministic, no external dependencies
3. **Isolation:** Each fixture tests one specific scenario
4. **Maintainability:** Easy to understand and modify
5. **CI-Friendly:** No network calls or timeouts

## Directory Structure

```
fixtures/
  basic/              # Basic package types
  styles/             # CSS/SCSS/Less packages
  dependencies/       # Dependency resolution scenarios
  entries/            # Entry point configurations
  edge-cases/         # Edge cases and error scenarios
  frameworks/         # Framework-specific packages
  outputs/            # Special build output scenarios
```

## Creating a New Fixture

### 1. Choose the Right Category

Place your fixture in the appropriate category directory:

- **basic/**: ESM, CJS, TypeScript, scoped packages
- **styles/**: CSS, SCSS, Less, CSS modules
- **dependencies/**: Missing deps, peer deps, nested deps
- **entries/**: Multiple entries, custom exports, browser field
- **edge-cases/**: Empty packages, special chars, deep nesting
- **frameworks/**: React, Vue, Svelte components
- **outputs/**: Source maps, chunks, assets

### 2. Create Directory Structure

```bash
mkdir -p tests/fixtures/<category>/<fixture-name>/{src,expected}
```

### 3. Add Required Files

Every fixture must have:

1. **package.json** - Package metadata
2. **src/** - Source files
3. **README.md** - What this fixture tests
4. **expected/** (optional) - Expected outputs

### 4. Use the Template

Copy this template for your fixture's README:

```markdown
# <Fixture Name>

## Purpose

Brief description of what this fixture tests.

## Package Contents

- `src/index.js` - Main entry point
- `src/foo.js` - Additional module
- `package.json` - Package configuration

## What It Tests

- [ ] Specific feature 1
- [ ] Edge case 2
- [ ] Error handling for scenario 3

## Expected Behavior

Describe what should happen when this package is built:

- Bundle size: ~X bytes
- Number of assets: Y
- Dependencies: Z

## Related Tests

- `tests/fixtures.test.ts` - Line XXX

## Notes

Any special considerations or known issues.
```

## Fixture Guidelines

### DO:

✅ Keep fixtures minimal - only what's needed to test the scenario  
✅ Use descriptive names (`missing-peer-deps` not `test1`)  
✅ Document what you're testing in README.md  
✅ Include expected outputs if they're complex  
✅ Test one thing per fixture  
✅ Use realistic but simple code

### DON'T:

❌ Don't copy real npm packages wholesale  
❌ Don't include unnecessary dependencies  
❌ Don't make fixtures too complex  
❌ Don't forget to document what you're testing  
❌ Don't hardcode absolute paths  
❌ Don't include large binary files

## Example: Simple ESM Fixture

```
fixtures/basic/simple-esm/
├── package.json
├── src/
│   └── index.js
├── expected/
│   └── size.json
└── README.md
```

**package.json:**

```json
{
  "name": "simple-esm",
  "version": "1.0.0",
  "type": "module",
  "main": "src/index.js"
}
```

**src/index.js:**

```javascript
export function hello(name) {
  return `Hello, ${name}!`
}
```

**expected/size.json:**

```json
{
  "size": 42,
  "gzip": 35
}
```

**README.md:**

```markdown
# Simple ESM

Tests basic ESM module bundling and size calculation.

## What It Tests

- Pure ESM module syntax
- Basic export statement
- Size calculation for simple functions
```

## Running Tests with Fixtures

### All Fixtures

```bash
yarn test tests/fixtures.test.ts
```

### Specific Category

```bash
yarn test tests/fixtures.test.ts -t "basic"
```

### Single Fixture

```bash
yarn test tests/fixtures.test.ts -t "simple-esm"
```

## Expected Test Output

Tests using fixtures should:

1. Load the fixture package
2. Build it with rspack
3. Assert on the output:
   - Size matches expected range
   - Assets are correct
   - Dependencies are resolved
   - No unexpected errors

Example test:

```typescript
test('simple-esm: builds pure ESM module', async () => {
  const fixturePath = path.join(__dirname, 'fixtures/basic/simple-esm')
  const result = await getPackageStats(fixturePath, { isLocal: true })

  expect(result.size).toBeGreaterThan(0)
  expect(result.size).toBeLessThan(100)
  expect(result.assets).toHaveLength(1)
  expect(result.assets[0].type).toBe('js')
})
```

## Maintenance

- Review fixtures quarterly for relevance
- Update when rspack behavior changes
- Remove obsolete fixtures
- Keep fixtures compatible with latest dependencies

## Contributing

When adding a new fixture:

1. Ensure it tests something not covered by existing fixtures
2. Keep it minimal and focused
3. Document thoroughly
4. Add corresponding test(s)
5. Update this README if adding a new category

## Questions?

See the main [MIGRATION_PLAN.md](../../MIGRATION_PLAN.md) for more context on the testing strategy.
