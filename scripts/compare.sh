#!/bin/bash

# Comprehensive comparison script for package-build-stats
# Usage: 
#   ./compare.sh list                      # Fetch and display top packages
#   ./compare.sh test <pkg1> <pkg2> ...   # Test specific packages
#   ./compare.sh top [N]                  # Test top N packages (default: 20)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ============================================================================
# Helper Functions
# ============================================================================

show_usage() {
    cat << EOF
${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}
${BLUE}║   Package Build Stats - Comparison Tool                  ║${NC}
${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}

${GREEN}USAGE:${NC}
  $0 list                        # Display top npm packages (static list)
  $0 test <pkg> [pkg2...]        # Test specific packages
  $0 top [N]                     # Test top N packages (default: 20)

${GREEN}EXAMPLES:${NC}
  $0 list                        # Show top packages from static list
  $0 test lodash react axios     # Compare these 3 packages
  $0 test lodash@4.17.21         # Test specific version
  $0 top 10                      # Test top 10 packages
  $0 top                         # Test top 20 packages

${GREEN}PERFORMANCE:${NC}
  ⚡ Tests run 5 packages in parallel for faster results
  
${GREEN}OUTPUT:${NC}
  Results are saved to: ${YELLOW}comparison-results/YYYYMMDD_HHMMSS/${NC}
  - Individual JSON files for each package
  - Comparison markdown report

EOF
}

# ============================================================================
# Command: LIST - Display top packages from static list
# ============================================================================

cmd_list() {
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   Top NPM Packages (Static List)                         ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""

    local LIST_FILE="$SCRIPT_DIR/top-packages-list.txt"
    
    if [ ! -f "$LIST_FILE" ]; then
        echo -e "${RED}Error: Static package list not found at $LIST_FILE${NC}"
        exit 1
    fi

    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  Top 200 NPM Packages                                     ${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo ""

    printf "${CYAN}%-5s %-50s${NC}\n" "Rank" "Package"
    printf "${CYAN}%-5s %-50s${NC}\n" "----" "-------"

    local rank=1
    grep -v '^#' "$LIST_FILE" | grep -v '^$' | while read -r pkg; do
        printf "${NC}%-5d %-50s\n" "$rank" "$pkg"
        rank=$((rank + 1))
    done | head -50

    echo ""
    echo -e "${GREEN}... (showing first 50 packages)${NC}"
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo ""

    local total=$(grep -v '^#' "$LIST_FILE" | grep -v '^$' | wc -l | tr -d ' ')
    echo -e "${BLUE}Total packages in list: ${YELLOW}$total${NC}"
    echo -e "${BLUE}Full list: ${YELLOW}$LIST_FILE${NC}"
    echo ""
    echo -e "${BLUE}To test packages:${NC}"
    echo -e "  ${YELLOW}$0 test lodash react axios${NC}    # Specific packages"
    echo -e "  ${YELLOW}$0 top 10${NC}                     # Top 10 from list"
    echo -e "  ${YELLOW}$0 top 20${NC}                     # Top 20 from list"
    echo ""
}

# ============================================================================
# Command: TEST - Compare packages
# ============================================================================

cmd_test() {
    local PACKAGES=("$@")
    
    if [ ${#PACKAGES[@]} -eq 0 ]; then
        echo -e "${RED}Error: No packages specified${NC}"
        show_usage
        exit 1
    fi

    local OUTPUT_DIR="$SCRIPT_DIR/comparison-results"
    local TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    local RESULT_DIR="$OUTPUT_DIR/$TIMESTAMP"
    mkdir -p "$RESULT_DIR"

    local CONCURRENCY=5  # Number of packages to test in parallel

    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   Package Comparison: Published vs Local HEAD            ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""

    local PUBLISHED_VERSION=$(npm view package-build-stats version 2>/dev/null || echo "unknown")
    echo -e "${GREEN}Published version: ${PUBLISHED_VERSION}${NC}"
    echo -e "${GREEN}Local version: HEAD${NC}"
    echo -e "${GREEN}Testing ${#PACKAGES[@]} package(s) (${CONCURRENCY} at a time)${NC}"
    echo ""

    # Build local version
    echo -e "${YELLOW}Building local version...${NC}"
    cd "$PROJECT_ROOT"
    corepack yarn build > /dev/null 2>&1
    echo -e "${GREEN}✓ Build completed${NC}"
    echo ""

    # Create test runner for published version
    cat > "$RESULT_DIR/test-published.js" << 'EOPUB'
const pkg = require('package-build-stats');

async function runTests(packageName) {
  const results = {
    package: packageName,
    version: 'published',
    timestamp: new Date().toISOString(),
    tests: {}
  };

  try {
    console.error(`[Published] Testing ${packageName}...`);
    
    // Test: getPackageStats
    try {
      const stats = await pkg.getPackageStats(packageName);
      results.tests.getPackageStats = {
        success: true,
        data: {
          size: stats.size,
          gzip: stats.gzip,
          dependencyCount: stats.dependencyCount,
          dependencySizes: stats.dependencySizes || [],
          hasJSModule: stats.hasJSModule,
          hasJSNext: stats.hasJSNext,
          hasSideEffects: stats.hasSideEffects,
          isModuleType: stats.isModuleType,
          peerDependencies: stats.peerDependencies,
          assets: stats.assets.map(a => ({ name: a.name, type: a.type, size: a.size, gzip: a.gzip }))
        }
      };
    } catch (err) {
      results.tests.getPackageStats = { success: false, error: err.message };
    }

    // Test: getAllPackageExports
    try {
      const exports = await pkg.getAllPackageExports(packageName);
      results.tests.getAllPackageExports = {
        success: true,
        data: { exportCount: Object.keys(exports).length, exports: exports }
      };
    } catch (err) {
      results.tests.getAllPackageExports = { success: false, error: err.message };
    }

    // Test: getPackageExportSizes
    try {
      const exportSizes = await pkg.getPackageExportSizes(packageName);
      results.tests.getPackageExportSizes = {
        success: true,
        data: {
          size: exportSizes.size,
          gzip: exportSizes.gzip,
          assets: exportSizes.assets.map(a => ({ name: a.name, type: a.type, size: a.size, gzip: a.gzip, path: a.path }))
        }
      };
    } catch (err) {
      results.tests.getPackageExportSizes = { success: false, error: err.message };
    }
  } catch (err) {
    results.error = err.message;
  }

  console.log(JSON.stringify(results, null, 2));
}

runTests(process.argv[2]).catch(err => { console.error('Fatal:', err); process.exit(1); });
EOPUB

    # Create test runner for local version
    cat > "$RESULT_DIR/test-local.js" << 'EOLOC'
const pkg = require('../../../build/index.js');

async function runTests(packageName) {
  const results = {
    package: packageName,
    version: 'local',
    timestamp: new Date().toISOString(),
    tests: {}
  };

  try {
    console.error(`[Local] Testing ${packageName}...`);
    
    // Test: getPackageStats
    try {
      const stats = await pkg.getPackageStats(packageName);
      results.tests.getPackageStats = {
        success: true,
        data: {
          size: stats.size,
          gzip: stats.gzip,
          dependencyCount: stats.dependencyCount,
          dependencySizes: stats.dependencySizes || [],
          hasJSModule: stats.hasJSModule,
          hasJSNext: stats.hasJSNext,
          hasSideEffects: stats.hasSideEffects,
          isModuleType: stats.isModuleType,
          peerDependencies: stats.peerDependencies,
          assets: stats.assets.map(a => ({ name: a.name, type: a.type, size: a.size, gzip: a.gzip }))
        }
      };
    } catch (err) {
      results.tests.getPackageStats = { success: false, error: err.message };
    }

    // Test: getAllPackageExports
    try {
      const exports = await pkg.getAllPackageExports(packageName);
      results.tests.getAllPackageExports = {
        success: true,
        data: { exportCount: Object.keys(exports).length, exports: exports }
      };
    } catch (err) {
      results.tests.getAllPackageExports = { success: false, error: err.message };
    }

    // Test: getPackageExportSizes
    try {
      const exportSizes = await pkg.getPackageExportSizes(packageName);
      results.tests.getPackageExportSizes = {
        success: true,
        data: {
          size: exportSizes.size,
          gzip: exportSizes.gzip,
          assets: exportSizes.assets.map(a => ({ name: a.name, type: a.type, size: a.size, gzip: a.gzip, path: a.path }))
        }
      };
    } catch (err) {
      results.tests.getPackageExportSizes = { success: false, error: err.message };
    }
  } catch (err) {
    results.error = err.message;
  }

  console.log(JSON.stringify(results, null, 2));
}

runTests(process.argv[2]).catch(err => { console.error('Fatal:', err); process.exit(1); });
EOLOC

    # Function to test a single package
    test_single_package() {
        local package=$1
        local result_dir=$2
        local safe_name=$(echo "$package" | sed 's/[@\/:]/_/g')
        
        # Test with published version
        cd "$result_dir"
        npx --yes package-build-stats@latest node test-published.js "$package" > "${safe_name}_published.json" 2>&1 || true
        
        # Test with local version
        node test-local.js "$package" > "${safe_name}_local.json" 2>&1 || true
        
        echo -e "${GREEN}✓ Completed: $package${NC}"
    }

    # Test packages in batches with concurrency
    local total=${#PACKAGES[@]}
    local count=0
    
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}Starting parallel tests...${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    for package in "${PACKAGES[@]}"; do
        echo -e "${YELLOW}▸ Testing: $package${NC}"
        
        # Start test in background
        test_single_package "$package" "$RESULT_DIR" &
        
        count=$((count + 1))
        
        # Wait when we hit concurrency limit or end of packages
        if [ $((count % CONCURRENCY)) -eq 0 ] || [ $count -eq $total ]; then
            wait
            echo ""
            echo -e "${BLUE}Progress: $count/$total packages tested${NC}"
            echo ""
        fi
    done
    
    # Final wait to ensure all background jobs complete
    wait
    
    echo ""
    echo -e "${GREEN}All package tests completed!${NC}"
    echo ""

    # Generate comparison report
    echo -e "${YELLOW}Generating comparison report...${NC}"
    
    cat > "$RESULT_DIR/report.md" << 'EOREP'
# Package Build Stats Comparison Report

**Date:** $(date)
**Published Version:** $(npm view package-build-stats version 2>/dev/null)
**Local Version:** HEAD

## Packages Tested

EOREP

    for package in "${PACKAGES[@]}"; do
        echo "- \`$package\`" >> "$RESULT_DIR/report.md"
    done

    echo "" >> "$RESULT_DIR/report.md"
    echo "## Results" >> "$RESULT_DIR/report.md"
    echo "" >> "$RESULT_DIR/report.md"

    # Generate comparison tables
    cd "$RESULT_DIR"
    node << 'EOGEN' >> report.md
const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.json'));
const packages = new Set();
files.forEach(f => { const m = f.match(/(.+)_(published|local)\.json/); if(m) packages.add(m[1]); });

packages.forEach(pkg => {
  const pubFile = `${pkg}_published.json`;
  const locFile = `${pkg}_local.json`;
  
  console.log(`\n### \`${pkg.replace(/_/g, '@')}\`\n`);
  
  if (!fs.existsSync(pubFile) || !fs.existsSync(locFile)) {
    console.log('❌ Missing result files\n');
    return;
  }
  
  const pub = JSON.parse(fs.readFileSync(pubFile, 'utf8'));
  const loc = JSON.parse(fs.readFileSync(locFile, 'utf8'));
  
  // getPackageStats
  console.log('#### getPackageStats\n');
  if (pub.tests?.getPackageStats?.success && loc.tests?.getPackageStats?.success) {
    const p = pub.tests.getPackageStats.data;
    const l = loc.tests.getPackageStats.data;
    console.log('| Metric | Published | Local | Diff |');
    console.log('|--------|-----------|-------|------|');
    console.log(`| Size | ${p.size} | ${l.size} | ${l.size - p.size} |`);
    console.log(`| Gzip | ${p.gzip} | ${l.gzip} | ${l.gzip - p.gzip} |`);
    console.log(`| Dependencies | ${p.dependencyCount} | ${l.dependencyCount} | ${l.dependencyCount - p.dependencyCount} |`);
    console.log(`| Assets | ${p.assets.length} | ${l.assets.length} | ${l.assets.length - p.assets.length} |`);
  } else {
    console.log('❌ Failed\n');
  }
  
  // getAllPackageExports
  console.log('\n#### getAllPackageExports\n');
  if (pub.tests?.getAllPackageExports?.success && loc.tests?.getAllPackageExports?.success) {
    const p = pub.tests.getAllPackageExports.data;
    const l = loc.tests.getAllPackageExports.data;
    console.log('| Metric | Published | Local | Diff |');
    console.log('|--------|-----------|-------|------|');
    console.log(`| Exports | ${p.exportCount} | ${l.exportCount} | ${l.exportCount - p.exportCount} |`);
  } else {
    console.log('❌ Failed\n');
  }
  
  // getPackageExportSizes
  console.log('\n#### getPackageExportSizes\n');
  if (pub.tests?.getPackageExportSizes?.success && loc.tests?.getPackageExportSizes?.success) {
    const p = pub.tests.getPackageExportSizes.data;
    const l = loc.tests.getPackageExportSizes.data;
    console.log('| Metric | Published | Local | Diff |');
    console.log('|--------|-----------|-------|------|');
    console.log(`| Size | ${p.size} | ${l.size} | ${l.size - p.size} |`);
    console.log(`| Gzip | ${p.gzip} | ${l.gzip} | ${l.gzip - p.gzip} |`);
    console.log(`| Assets | ${p.assets.length} | ${l.assets.length} | ${l.assets.length - p.assets.length} |`);
  } else {
    console.log('❌ Failed\n');
  }
});
EOGEN

    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║   Comparison Complete!                                    ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Results:${NC} ${YELLOW}$RESULT_DIR${NC}"
    echo -e "${BLUE}Report:${NC}  ${YELLOW}cat $RESULT_DIR/report.md${NC}"
    echo ""
}

# ============================================================================
# Command: TOP - Test top N packages
# ============================================================================

cmd_top() {
    local N=${1:-20}
    
    echo -e "${BLUE}Testing top $N packages from static list...${NC}"
    echo ""
    
    # Use static list file
    local LIST_FILE="$SCRIPT_DIR/top-packages-list.txt"
    
    if [ ! -f "$LIST_FILE" ]; then
        echo -e "${RED}Error: Static package list not found at $LIST_FILE${NC}"
        exit 1
    fi
    
    # Read top N packages (skip comments and empty lines)
    local PACKAGES=($(grep -v '^#' "$LIST_FILE" | grep -v '^$' | head -n "$N"))
    
    echo -e "${GREEN}Will test ${#PACKAGES[@]} packages:${NC}"
    printf '  %s\n' "${PACKAGES[@]}"
    echo ""
    
    read -p "Continue? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
    
    cmd_test "${PACKAGES[@]}"
}

# ============================================================================
# Main
# ============================================================================

case "${1:-}" in
    list)
        cmd_list
        ;;
    test)
        shift
        cmd_test "$@"
        ;;
    top)
        shift
        cmd_top "$@"
        ;;
    help|--help|-h|"")
        show_usage
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo ""
        show_usage
        exit 1
        ;;
esac
