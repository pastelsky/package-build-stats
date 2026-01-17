# Package Build Stats - Comparison Script

Single comprehensive script to compare published vs local versions of package-build-stats.

## Usage

```bash
./compare.sh <command>
```

## Commands

### 1. **list** - Display top npm packages

```bash
./compare.sh list
```

Displays the top npm packages from a hardcoded static list (no network calls).

**Example output:**

```
Rank  Package
----  -------
1     semver
2     debug
3     chalk
4     ms
5     tslib
...
```

The full list of 200 packages is stored in [`top-packages-list.txt`](./top-packages-list.txt:1)

---

### 2. **test** - Test specific packages

```bash
./compare.sh test <package1> [package2] [package3] ...
```

Tests specific packages and compares published vs local HEAD versions.

**⚡ Parallel Execution:** Tests run 5 packages in parallel at a time for faster results.

**Examples:**

```bash
# Test single package
./compare.sh test lodash

# Test multiple packages (runs 5 in parallel)
./compare.sh test lodash react axios express vue next redux

# Test specific versions
./compare.sh test lodash@4.17.21 react@18.2.0
```

**What it tests:**

- `getPackageStats()` - Size, gzip, dependencies, assets
- `getAllPackageExports()` - Export discovery and count
- `getPackageExportSizes()` - Per-export size analysis

**Output:** Creates timestamped directory with:

- `<package>_published.json` - Published version results
- `<package>_local.json` - Local HEAD results
- `report.md` - Comparison tables

---

### 3. **top** - Test top N packages

```bash
./compare.sh top [N]
```

Tests the top N packages (default: 20) from the static list.

**⚡ Parallel Execution:** Tests run 5 packages in parallel at a time.

**Examples:**

```bash
# Test top 20 packages (runs in batches of 5)
./compare.sh top

# Test top 10 packages
./compare.sh top 10

# Test top 5 packages (single batch)
./compare.sh top 5

# Test top 50 packages (10 batches of 5)
./compare.sh top 50
```

---

## Quick Examples

```bash
# First, see what the top packages are
./compare.sh list

# Test a few popular ones
./compare.sh test lodash react axios

# Or test all top 20
./compare.sh top 20
```

## Output

Results are saved to: `comparison-results/YYYYMMDD_HHMMSS/`

Example structure:

```
comparison-results/20251102_123456/
├── lodash_published.json       # Published version results
├── lodash_local.json           # Local version results
├── react_published.json
├── react_local.json
├── report.md                   # Markdown comparison report
├── test-published.js           # Test runner (published)
└── test-local.js              # Test runner (local)
```

### Report Format

The `report.md` contains comparison tables for each package:

```markdown
### `lodash`

#### getPackageStats

| Metric       | Published | Local  | Diff |
| ------------ | --------- | ------ | ---- |
| Size         | 71,657    | 71,659 | +2   |
| Gzip         | 25,426    | 25,428 | +2   |
| Dependencies | 0         | 0      | 0    |
| Assets       | 1         | 1      | 0    |

#### getAllPackageExports

| Metric  | Published | Local | Diff |
| ------- | --------- | ----- | ---- |
| Exports | 352       | 352   | 0    |

#### getPackageExportSizes

| Metric | Published | Local  | Diff |
| ------ | --------- | ------ | ---- |
| Size   | 71,657    | 71,659 | +2   |
| Gzip   | 25,426    | 25,428 | +2   |
| Assets | 352       | 352    | 0    |
```

## Package List

The script uses a hardcoded list of 200 popular packages stored in [`top-packages-list.txt`](./top-packages-list.txt:1).

**Top 20 from the list:**

1. semver
2. debug
3. chalk
4. ms
5. tslib
6. commander
7. @types/node
8. uuid
9. yargs
10. typescript
11. node-fetch
12. @babel/core
13. lodash
14. axios
15. dotenv
16. esbuild
17. async
18. eslint
19. prettier
20. zod

The list includes utilities, frameworks, build tools, testing libraries, and more. You can edit `top-packages-list.txt` to customize which packages to test.

## Tips

### For quick testing during development:

```bash
./compare.sh test lodash
```

### Before submitting a PR:

```bash
./compare.sh test lodash react vue axios express
```

### For comprehensive regression testing:

```bash
./compare.sh top 20
```

### To view results:

```bash
# List all result directories
ls -lt comparison-results/

# View latest report
cat comparison-results/$(ls -t comparison-results/ | head -1)/report.md

# View specific package results
jq '.' comparison-results/$(ls -t comparison-results/ | head -1)/lodash_published.json
```

## Performance

- **Parallel execution:** Tests run 5 packages at a time for faster results
- Testing 20 packages takes ~1/5th the time vs sequential testing
- Each batch waits for all 5 packages to complete before starting the next batch

## Notes

- Script automatically builds local version before testing
- Published version fetched via `npx package-build-stats@latest`
- All results timestamped and preserved
- Colors can be disabled with `NO_COLOR=1`
- Package list is static (no network calls for listing packages)
- To update the package list, edit `top-packages-list.txt` manually
- Concurrency level is set to 5 (can be modified in the script)

## Files

- **`compare.sh`** - Main comparison script
- **`top-packages-list.txt`** - Static list of 200 popular npm packages
- **`README-COMPARE.md`** - This documentation
- **`comparison-results/`** - Generated test results (timestamped)
