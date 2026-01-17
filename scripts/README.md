# Package Build Stats - Comparison Scripts

This directory contains scripts to compare the published version of `package-build-stats` with your local HEAD version.

## Available Scripts

### 1. `fetch-top-packages.sh` - Get Top NPM Packages

Fetches the current top packages from npm by weekly downloads and saves them to `top-20-packages.txt`.

```bash
./fetch-top-packages.sh
```

**Output:**

- Displays top 30 packages ranked by weekly downloads
- Saves top 20 to `top-20-packages.txt` for easy use
- Shows real-time download statistics from npm API

**Current Top 20 (as of Nov 2025):**

1. semver (460M+ weekly downloads)
2. debug (408M+ weekly downloads)
3. chalk (328M+ weekly downloads)
4. ms (294M+ weekly downloads)
5. tslib (268M+ weekly downloads)
6. commander (231M+ weekly downloads)
7. @types/node (173M+ weekly downloads)
8. uuid (171M+ weekly downloads)
9. yargs (126M+ weekly downloads)
10. typescript (101M+ weekly downloads)
11. node-fetch (79M+ weekly downloads)
12. @babel/core (76M+ weekly downloads)
13. lodash (76M+ weekly downloads)
14. axios (72M+ weekly downloads)
15. dotenv (70M+ weekly downloads)
16. esbuild (70M+ weekly downloads)
17. async (69M+ weekly downloads)
18. eslint (65M+ weekly downloads)
19. prettier (57M+ weekly downloads)
20. zod (53M+ weekly downloads)

---

### 2. `compare-versions.sh` - Full Comparison Suite

Comprehensive comparison script that tests multiple functions for each package.

```bash
./compare-versions.sh <package1> <package2> ...

# Examples
./compare-versions.sh lodash react axios
./compare-versions.sh react@18.2.0 vue@3.3.0
```

**What it tests:**

- `getPackageStats()` - Size, gzip, dependencies, metadata
- `getAllPackageExports()` - Export discovery
- `getPackageExportSizes()` - Per-export size analysis

**Output:**

- Creates timestamped directory in `comparison-results/`
- Generates JSON files for published and local versions
- Creates markdown comparison report with tables

**Generated files:**

```
comparison-results/YYYYMMDD_HHMMSS/
├── <package>_published.json
├── <package>_local.json
├── comparison-report.md
├── test-published.js
└── test-local.js
```

---

### 3. `quick-compare.sh` - Interactive CLI Comparison

Quick, interactive comparison using the CLI tool.

```bash
./quick-compare.sh <package1> <package2> ...

# Example
./quick-compare.sh lodash react
```

**Features:**

- Shows output from published version CLI
- Shows output from local version
- Interactive pauses between packages
- Good for visual inspection

---

### 4. `test-top-packages.sh` - Automated Top Package Testing

Tests all top 20 packages automatically.

```bash
./test-top-packages.sh
```

This script:

1. Loads the top 20 packages from `top-20-packages.txt`
2. Runs full comparison on all of them
3. Generates comprehensive report

---

## Quick Start

### Test a few popular packages:

```bash
# Fetch latest top packages
./fetch-top-packages.sh

# Test specific packages
./compare-versions.sh lodash react axios express

# Or test all top 20
./test-top-packages.sh
```

### Test with versions:

```bash
./compare-versions.sh lodash@4.17.21 react@18.2.0 axios@1.6.0
```

---

## Understanding the Output

### Comparison Report Format

The markdown report includes tables comparing:

**getPackageStats Comparison:**
| Metric | Published | Local | Diff |
|--------|-----------|-------|------|
| Size | 71,657 | 71,659 | +2 |
| Gzip | 25,426 | 25,428 | +2 |
| Dependencies | 0 | 0 | 0 |

**getAllPackageExports Comparison:**
| Metric | Published | Local | Diff |
|--------|-----------|-------|------|
| Export Count | 352 | 352 | 0 |

**getPackageExportSizes Comparison:**
| Metric | Published | Local | Diff |
|--------|-----------|-------|------|
| Size | 71,657 | 71,659 | +2 |
| Assets Count | 352 | 352 | 0 |

---

## Tips

### For CI/CD Integration:

```bash
# Non-interactive version
./compare-versions.sh $(head -5 top-20-packages.txt)

# Check for significant differences
node -e "
const results = require('./comparison-results/latest/lodash_published.json');
// Add your validation logic
"
```

### For Development:

```bash
# Quick test during development
./quick-compare.sh lodash

# Full test before PR
./compare-versions.sh lodash react vue express axios
```

### Filtering Packages:

```bash
# Test only utility packages
./compare-versions.sh semver debug chalk ms uuid

# Test only frontend packages
./compare-versions.sh react vue @angular/core svelte

# Test only build tools
./compare-versions.sh webpack vite esbuild rollup
```

---

## Troubleshooting

### "Package not found"

Some packages might not be publicly available or might have been removed. Skip them or update the list.

### Timeout errors

Large packages (like webpack, typescript) might take longer. The script has appropriate timeouts set, but you can modify them in the test runner scripts.

### Out of memory

Testing many packages simultaneously can be memory-intensive. Test in smaller batches:

```bash
# Instead of all 20 at once
./compare-versions.sh $(head -5 top-20-packages.txt)
./compare-versions.sh $(head -10 top-20-packages.txt | tail -5)
```

---

## File Structure

```
scripts/
├── README.md                    # This file
├── fetch-top-packages.sh        # Get top packages from npm
├── compare-versions.sh          # Full comparison suite
├── quick-compare.sh             # Interactive CLI comparison
├── test-top-packages.sh         # Test all top packages
├── top-20-packages.txt          # Current top 20 packages
├── top-packages.txt             # Extended list with categories
└── comparison-results/          # Generated results
    └── YYYYMMDD_HHMMSS/        # Timestamped results
        ├── *_published.json     # Published version results
        ├── *_local.json         # Local version results
        └── comparison-report.md # Human-readable report
```

---

## Notes

- The scripts automatically build your local version before testing
- Published version is fetched via `npx package-build-stats@latest`
- All comparison results are saved with timestamps
- Scripts use colors for better readability (disable with `NO_COLOR=1`)
