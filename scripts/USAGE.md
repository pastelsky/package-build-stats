# Package Build Stats - Comparison Tools Usage Guide

## Overview

The comparison tools help you test and compare package-build-stats results between published npm versions and your local development build. All scripts have been consolidated into a single TypeScript CLI tool for consistency and maintainability.

## Quick Start

```bash
# Navigate to scripts directory
cd scripts

# List available packages
tsx index.ts list

# Test specific packages
tsx index.ts test lodash react axios

# Test top 10 packages
tsx index.ts top 10

# Get help
tsx index.ts help
```

## Installation

No additional installation required! The scripts use `tsx` (TypeScript execute) which should be available in the project.

## Commands

### 1. `list` - Display Available Packages

Shows the curated list of popular npm packages for testing.

**Usage:**

```bash
tsx index.ts list [options]
```

**Options:**

- `--all` - Show all packages (default shows first 50)

**Examples:**

```bash
# Show first 50 packages
tsx index.ts list

# Show all packages
tsx index.ts list --all
```

**Output:**

- Displays rank and package name
- Shows total count
- Provides usage tips

---

### 2. `test` - Test Specific Packages

Compare published vs local version for specific packages.

**Usage:**

```bash
tsx index.ts test <package1> [package2] [...] [options]
```

**Options:**

- `--concurrency N` - Number of parallel tests (default: 5)
- `--timeout MS` - Timeout in milliseconds (default: 120000)
- `--json` - Output results as JSON

**Examples:**

```bash
# Test single package
tsx index.ts test lodash

# Test multiple packages
tsx index.ts test lodash react axios vue

# Test specific versions
tsx index.ts test lodash@4.17.21 react@18.2.0

# Increase concurrency
tsx index.ts test lodash react --concurrency 10

# Output as JSON
tsx index.ts test lodash --json
```

**Output:**

- Progress tracking
- Individual test results
- Summary (improved/regressed/unchanged)
- Results saved to `comparison-results/YYYYMMDD_HHMMSS/`
- Markdown report generated

---

### 3. `top` - Test Top N Packages

Test the most popular packages from the curated list.

**Usage:**

```bash
tsx index.ts top [N] [options]
```

**Arguments:**

- `N` - Number of packages to test (default: 20)

**Options:**

- Same as `test` command

**Examples:**

```bash
# Test top 20 packages (default)
tsx index.ts top

# Test top 10 packages
tsx index.ts top 10

# Test top 50 packages
tsx index.ts top 50

# Test top 5 with higher concurrency
tsx index.ts top 5 --concurrency 10
```

**Performance Estimates:**

- Average test time: ~60 seconds per package
- With concurrency=5: 20 packages in ~4 minutes
- With concurrency=10: 20 packages in ~2 minutes

---

## Configuration

### Environment Variables

```bash
# Set concurrency
export CONCURRENCY=10

# Set timeout (milliseconds)
export TIMEOUT=180000

# Set package manager
export PKG_MANAGER=yarn
```

### Config File

Configuration is centralized in `utils/config.ts`:

```typescript
{
  concurrency: 5,           // Parallel test limit
  timeout: 120000,          // Test timeout (2 minutes)
  packageManager: 'yarn',   // npm, yarn, pnpm, or bun
}
```

---

## Output & Results

### Directory Structure

```
comparison-results/
└── 20260117_143022/
    ├── lodash_result.json           # Individual results
    ├── react_result.json
    ├── axios_result.json
    └── report.md                    # Summary report
```

### Result Format

Each result JSON contains:

```json
{
  "package": "lodash",
  "publishedVersion": "latest",
  "localVersion": "HEAD",
  "publishedStats": {
    "size": 69961,
    "gzip": 25239,
    "dependencyCount": 0,
    "assets": [...]
  },
  "localStats": {
    "size": 69919,
    "gzip": 25211,
    "dependencyCount": 0,
    "assets": [...]
  },
  "timestamp": "2026-01-17T21:30:45.123Z",
  "differences": {
    "sizeChange": -42,
    "sizeChangePercent": -0.06,
    "gzipChange": -28,
    "gzipChangePercent": -0.11
  }
}
```

### Report Format

The markdown report includes:

- **Summary**: Total packages, improved, regressed, unchanged
- **Detailed Results**: Table for each package with size/gzip changes
- **Icons**: 📉 (smaller), 📈 (larger), ➡️ (unchanged)

---

## Performance Tips

### Optimize Concurrency

```bash
# For fast machines with good network
tsx index.ts test pkg1 pkg2 pkg3 --concurrency 10

# For slower machines or limited bandwidth
tsx index.ts test pkg1 pkg2 pkg3 --concurrency 2
```

### Incremental Testing

Test in batches during development:

```bash
# Quick smoke test (3 popular packages)
tsx index.ts test lodash react axios

# Medium test (top 10)
tsx index.ts top 10

# Full regression test (top 50)
tsx index.ts top 50
```

### Caching

The tool uses a `.master-cache` directory to cache published version builds, speeding up repeated tests.

---

## Common Use Cases

### Pre-PR Testing

```bash
# Test top 10 most popular packages
tsx index.ts top 10

# Review report
cat comparison-results/latest/report.md
```

### Debugging Size Regressions

```bash
# Test specific package with issues
tsx index.ts test webpack

# Check detailed results
cat comparison-results/*/webpack_result.json
```

### Performance Comparison

```bash
# Test build tools
tsx index.ts test webpack vite rollup esbuild

# Test frameworks
tsx index.ts test react vue @angular/core svelte
```

### Version Comparison

```bash
# Compare different versions
tsx index.ts test lodash@4.17.20 lodash@4.17.21
```

---

## Troubleshooting

### Tests Timing Out

Increase timeout:

```bash
tsx index.ts test large-package --timeout 300000
```

### Network Issues

Reduce concurrency:

```bash
tsx index.ts top 20 --concurrency 2
```

### Memory Issues

Test in smaller batches:

```bash
tsx index.ts top 10
# Wait for completion
tsx index.ts test pkg11 pkg12 ... pkg20
```

---

## Architecture

### Consolidated Structure

```
scripts/
├── index.ts                 # Main entry point
├── commands/
│   ├── list.ts              # List command
│   ├── test.ts              # Test command
│   └── top.ts               # Top command
├── utils/
│   ├── cli.ts               # Argument parsing
│   ├── config.ts            # Configuration
│   ├── logger.ts            # Logging utilities
│   ├── package-loader.ts    # Package list management
│   ├── results.ts           # Results formatting
│   └── runner.ts            # Test execution
├── comparison-rules.ts      # Comparison logic
└── runner.ts                # Package stats runner
```

### Benefits of Consolidation

1. **Single Source of Truth**: All logic in TypeScript
2. **Type Safety**: Catch errors at compile time
3. **Consistency**: Same behavior across all commands
4. **Maintainability**: One place to fix bugs
5. **Testability**: Unit tests possible for all utilities
6. **Extensibility**: Easy to add new commands

---

## Legacy Scripts (Deprecated)

The following scripts are now deprecated but kept for backward compatibility:

- `compare.sh` → Use `tsx index.ts test`
- `compare.js` → Use `tsx index.ts test`
- `compare-versions.sh` → Use `tsx index.ts test`
- `quick-compare.sh` → Use `tsx index.ts test`
- `fetch-top-packages.sh` → Package list is now static

**Migration Path:**

```bash
# Old way
./compare.sh test lodash react

# New way
tsx index.ts test lodash react
```

---

## Adding to package.json

For easier access, add to your package.json:

```json
{
  "scripts": {
    "compare:list": "tsx scripts/index.ts list",
    "compare:test": "tsx scripts/index.ts test",
    "compare:top": "tsx scripts/index.ts top"
  }
}
```

Then use:

```bash
npm run compare:list
npm run compare:test lodash react
npm run compare:top 10
```

---

## Examples

### Example 1: Quick Development Test

```bash
# Test 3 packages quickly
tsx index.ts test lodash react axios

# Output:
# ╔══════════════════════════════════════════════════════════╗
# ║ Package Comparison: Published vs Local                  ║
# ╚══════════════════════════════════════════════════════════╝
#
# Testing 3 package(s)
# Concurrency: 5 at a time
#
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ℹ Testing: lodash
# ℹ Testing: react
# ℹ Testing: axios
# ✓ Completed: axios
# ✓ Completed: lodash
# ✓ Completed: react
# ℹ Progress: 3/3 packages
#
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ✓ All package tests completed!
#
# SUMMARY:
#   Improved:  2 packages (smaller size)
#   Regressed: 1 packages (larger size)
#   Unchanged: 0 packages
```

### Example 2: Comprehensive Pre-PR Test

```bash
# Test top 20 packages
tsx index.ts top 20

# Check for regressions in report
cat comparison-results/*/report.md | grep "📈"
```

### Example 3: Custom Package List

```bash
# Test specific category
tsx index.ts test \
  webpack vite rollup esbuild \
  --concurrency 4
```

---

## Contributing

When adding new features:

1. Add utility functions to `utils/`
2. Add commands to `commands/`
3. Update help text in `utils/cli.ts`
4. Update this guide
5. Add tests if applicable

---

## Support

For issues or questions:

- Check this usage guide first
- Review error messages (they're descriptive)
- Check the generated reports in `comparison-results/`
- File an issue with reproduction steps
