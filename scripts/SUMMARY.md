# Compare Script Summary

## ✅ What's New

### 🚀 Parallel Execution

- Tests now run **5 packages at a time** in parallel
- Dramatically faster for testing multiple packages
- Example: Testing 20 packages is **~5x faster** than sequential

### 📦 Static Package List

- **200 popular packages** hardcoded in `top-packages-list.txt`
- **No network calls** needed for listing packages
- Instant list command
- Easily customizable

## 📁 Files

```
scripts/
├── compare.sh                  ⭐ Main script (with parallel execution)
├── top-packages-list.txt       📦 Static list of 200 packages
├── README-COMPARE.md          📖 Full documentation
└── SUMMARY.md                 📝 This file
```

## 🎯 Quick Start

```bash
cd scripts

# 1. See available packages (instant, no network)
./compare.sh list

# 2. Test a few packages (runs 5 in parallel)
./compare.sh test lodash react axios vue express

# 3. Test top 10 packages (runs in 2 batches)
./compare.sh top 10

# 4. Test top 20 packages (runs in 4 batches)
./compare.sh top 20
```

## ⚡ Performance Example

**Sequential (old way):**

```
Package 1: ████████ 60s
Package 2: ████████ 60s
Package 3: ████████ 60s
Package 4: ████████ 60s
Package 5: ████████ 60s
Total: 300 seconds
```

**Parallel (new way - 5 at once):**

```
Batch 1: ████████ 60s
  ├─ Package 1
  ├─ Package 2
  ├─ Package 3
  ├─ Package 4
  └─ Package 5
Total: 60 seconds
```

## 📊 Example Output

```bash
$ ./compare.sh test lodash react axios

╔═══════════════════════════════════════════════════════════╗
║   Package Comparison: Published vs Local HEAD            ║
╚═══════════════════════════════════════════════════════════╝

Published version: 7.3.14
Local version: HEAD
Testing 3 package(s) (5 at a time)

Building local version...
✓ Build completed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Starting parallel tests...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

▸ Testing: lodash
▸ Testing: react
▸ Testing: axios

✓ Completed: axios
✓ Completed: lodash
✓ Completed: react

Progress: 3/3 packages tested

All package tests completed!

╔═══════════════════════════════════════════════════════════╗
║   Comparison Complete!                                    ║
╚═══════════════════════════════════════════════════════════╝

Results: comparison-results/20251102_123456
Report:  cat comparison-results/20251102_123456/report.md
```

## 🔧 Customization

### Change Concurrency Level

Edit `compare.sh` line ~67:

```bash
local CONCURRENCY=5  # Change to 10 for more parallelism
```

### Modify Package List

Edit `top-packages-list.txt` - add/remove packages as needed.

## 📈 Benchmark Estimates

Based on average package test time of ~60 seconds:

| Packages | Sequential | Parallel (5x) | Time Saved |
| -------- | ---------- | ------------- | ---------- |
| 5        | 5 min      | 1 min         | 4 min      |
| 10       | 10 min     | 2 min         | 8 min      |
| 20       | 20 min     | 4 min         | 16 min     |
| 50       | 50 min     | 10 min        | 40 min     |
| 100      | 100 min    | 20 min        | 80 min     |

## 🎯 Use Cases

### Quick Development Testing

```bash
# Test just the packages you care about
./compare.sh test lodash react
```

### Pre-PR Testing

```bash
# Test top 10 most popular packages
./compare.sh top 10
```

### Comprehensive Regression Testing

```bash
# Test top 50 packages
./compare.sh top 50
```

### Custom Package Set

```bash
# Test a specific category
./compare.sh test webpack vite rollup esbuild  # Build tools
./compare.sh test react vue @angular/core svelte  # Frameworks
./compare.sh test jest vitest mocha chai  # Testing libraries
```

## 📝 Output Files

After running tests:

```
comparison-results/20251102_123456/
├── lodash_published.json       # Published version results
├── lodash_local.json           # Local version results
├── react_published.json
├── react_local.json
├── axios_published.json
├── axios_local.json
├── report.md                   # Human-readable comparison
├── test-published.js           # Test runner script
└── test-local.js              # Test runner script
```

## 🎉 Ready to Use!

```bash
cd scripts
./compare.sh help
```
