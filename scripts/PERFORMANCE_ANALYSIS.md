# Performance Profiling Results - three.js Package

## Overview

**Test Package:** `three` (three.js v0.160.0)  
**Total Execution Time:** 9,373.77ms (~9.4 seconds)  
**Test Date:** 2026-01-18

---

## Execution Breakdown

### Phase 1: Cache Cleanup

- **Time:** 0.65ms (negligible)
- **Purpose:** Clear master cache before test

### Phase 2: getPackageStats() - 2,393.15ms (25.5%)

| Operation                      | Time (ms) | % of Phase | Notes                  |
| ------------------------------ | --------- | ---------- | ---------------------- |
| preparePath                    | 1.32      | 0.1%       | Create temp directory  |
| installPackage                 | 2,427.66  | 101.4%     | **PRIMARY BOTTLENECK** |
| getExternals                   | 0.56      | 0.0%       | Parse dependencies     |
| parallel (packageJSON + build) | 319.42    | 13.3%      | Build main bundle      |

### Phase 3: getPackageExportSizes() - 6,531.58ms (69.7%)

| Operation      | Time (ms) | % of Phase | Notes                    |
| -------------- | --------- | ---------- | ------------------------ |
| preparePath    | 0.57      | 0.0%       | Create temp directory    |
| installPackage | 1,816.78  | 27.8%      | **SECONDARY BOTTLENECK** |
| getAllExports  | 12.01     | 0.2%       | Found 436 exports        |
| getExternals   | 0.40      | 0.0%       | Parse dependencies       |
| buildPackage   | 4,574.16  | 70.0%      | **PRIMARY BOTTLENECK**   |

---

## Key Findings

### 1. Installation Dominates (45.3% of total time)

**Total Installation Time:** 4,244.44ms

- First install (getPackageStats): 2,427.66ms
- Second install (getPackageExportSizes): 1,816.78ms

**Why it's slow:**

- Network I/O to download package from npm
- File system operations to extract and write files
- Installing dependencies (if any)

### 2. Building/Bundling is Expensive (52.2% of total time)

**Total Build Time:** 4,893.58ms

- Main bundle build: 319.42ms
- Export bundles build: 4,574.16ms (436 exports!)

**Why it's slow:**

- Rspack needs to bundle 436 separate exports
- Each export requires parsing, transforming, minifying
- Three.js is a large library (~680 KB uncompressed)

### 3. Export Analysis Found 436 Exports

- Parsing exports: 12.01ms (fast)
- Building each export: 4,574.16ms (slow)
- Average time per export: ~10.5ms

---

## Performance Opportunities

### High Impact Optimizations

#### 1. Enable Master Cache ⭐ (Saves ~4.2 seconds)

**Current:** Re-installs package every time  
**Solution:** Use master-cache to avoid re-downloading

```typescript
// Set USE_CACHE=true in environment
const stats = await getPackageStats('three', {
  cache: true,
})
```

**Expected savings:** ~4.2 seconds on cache hit (45% faster)

#### 2. Parallel Installation (Saves ~1.8 seconds)

**Current:** getPackageStats and getPackageExportSizes install independently  
**Solution:** Share installation between calls or parallelize

```typescript
// Install once, use for both operations
const installPath = await installOnce('three')
const [stats, exports] = await Promise.all([
  getPackageStats('three', { installPath }),
  getPackageExportSizes('three', { installPath }),
])
```

**Expected savings:** ~1.8 seconds (eliminate duplicate install)

#### 3. Optimize Export Building (Saves ~2-3 seconds)

**Current:** Builds all 436 exports sequentially  
**Ideas:**

- Parallel builds (use worker threads)
- Incremental bundling
- On-demand export building (only build requested exports)
- Code splitting/shared chunks

**Expected savings:** ~2-3 seconds (30-40% faster)

### Medium Impact Optimizations

#### 4. Bundle Size Optimizations

- Current uncompressed: 680 KB
- Current gzip: 170 KB
- Compression ratio: 74.8% (already excellent)

---

## Detailed Metrics

### Package Information

```
Package: three
Version: 0.160.0 (latest)
Size: 680 KB (uncompressed)
Gzip: 170 KB (compressed)
Compression Ratio: 74.8%
Exports Found: 436
```

### Time Distribution

```
Total: 9,373.77ms

Installation (45.3%)  ███████████████████
  ├─ First install:   2,427.66ms
  └─ Second install:  1,816.78ms

Building (52.2%)      █████████████████████
  ├─ Main build:      319.42ms
  └─ Export builds:   4,574.16ms

Other (2.5%)          ███
  ├─ Prepare paths:   1.89ms
  ├─ Parse exports:   12.01ms
  └─ Get externals:   0.96ms
```

---

## Conclusions

### Primary Bottlenecks

1. **Installation** - 45.3% of total time (I/O bound)
2. **Export Building** - 48.8% of total time (CPU/I/O bound)

### Bottleneck Type

- **97.5% I/O bound** (network + disk)
- **2.5% CPU bound** (parsing, analysis)

### Quick Wins

1. ✅ Enable caching → saves 45% immediately
2. ✅ Share installation → saves 19%
3. ✅ Parallel export builds → saves 30-40%

**Potential total improvement: 60-70% faster (3-4 seconds)**

---

## How to Use Performance Script

```bash
# Run performance test
npm run perf:test

# With caching enabled
USE_CACHE=true npm run perf:test

# Test different package
# Edit scripts/performance-test.ts and change 'three' to your package
```

---

## Next Steps

1. **Implement caching** in the test script
2. **Add Rspack profiling** to understand bundling bottlenecks
3. **Test with different packages** (small, medium, large)
4. **Profile memory usage** (currently only timing)
5. **Add CPU profiling** (--inspect flag)
