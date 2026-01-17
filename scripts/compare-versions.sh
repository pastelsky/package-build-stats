#!/bin/bash

# Script to compare package-build-stats published version vs local HEAD
# Usage: ./compare-versions.sh <package1> <package2> ...
# Example: ./compare-versions.sh lodash@4.17.21 react@18.2.0

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Output directory
OUTPUT_DIR="$SCRIPT_DIR/comparison-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULT_DIR="$OUTPUT_DIR/$TIMESTAMP"

mkdir -p "$RESULT_DIR"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Package Build Stats Version Comparison Tool             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if packages are provided
if [ $# -eq 0 ]; then
    echo -e "${RED}Error: No packages specified${NC}"
    echo "Usage: $0 <package1> <package2> ..."
    echo "Example: $0 lodash@4.17.21 react@18.2.0 axios"
    exit 1
fi

# Get published version
PUBLISHED_VERSION=$(npm view package-build-stats version 2>/dev/null || echo "unknown")
echo -e "${GREEN}Published version: ${PUBLISHED_VERSION}${NC}"
echo -e "${GREEN}Comparing with: LOCAL HEAD${NC}"
echo ""

# Build local version
echo -e "${YELLOW}Building local version...${NC}"
cd "$PROJECT_ROOT"
corepack yarn build > /dev/null 2>&1
echo -e "${GREEN}✓ Local build completed${NC}"
echo ""

# Create test runner scripts
TEST_RUNNER_PUBLISHED="$RESULT_DIR/test-published.js"
TEST_RUNNER_LOCAL="$RESULT_DIR/test-local.js"

# Function to create test runner for published version
create_published_test_runner() {
    cat > "$TEST_RUNNER_PUBLISHED" << 'EOF'
const pkg = require('package-build-stats');

async function runTests(packageName) {
  const results = {
    package: packageName,
    version: 'published',
    timestamp: new Date().toISOString(),
    tests: {}
  };

  try {
    // Test 1: getPackageStats
    console.error(`Testing getPackageStats for ${packageName}...`);
    try {
      const stats = await pkg.getPackageStats(packageName);
      results.tests.getPackageStats = {
        success: true,
        data: {
          size: stats.size,
          gzip: stats.gzip,
          dependencyCount: stats.dependencyCount,
          dependencySizes: stats.dependencySizes,
          hasJSModule: stats.hasJSModule,
          hasJSNext: stats.hasJSNext,
          hasSideEffects: stats.hasSideEffects,
          isModuleType: stats.isModuleType,
          peerDependencies: stats.peerDependencies,
          assets: stats.assets.map(a => ({
            name: a.name,
            type: a.type,
            size: a.size,
            gzip: a.gzip
          }))
        }
      };
    } catch (err) {
      results.tests.getPackageStats = {
        success: false,
        error: err.message
      };
    }

    // Test 2: getAllPackageExports
    console.error(`Testing getAllPackageExports for ${packageName}...`);
    try {
      const exports = await pkg.getAllPackageExports(packageName);
      results.tests.getAllPackageExports = {
        success: true,
        data: {
          exportCount: Object.keys(exports).length,
          exports: exports
        }
      };
    } catch (err) {
      results.tests.getAllPackageExports = {
        success: false,
        error: err.message
      };
    }

    // Test 3: getPackageExportSizes
    console.error(`Testing getPackageExportSizes for ${packageName}...`);
    try {
      const exportSizes = await pkg.getPackageExportSizes(packageName);
      results.tests.getPackageExportSizes = {
        success: true,
        data: {
          size: exportSizes.size,
          gzip: exportSizes.gzip,
          assets: exportSizes.assets.map(a => ({
            name: a.name,
            type: a.type,
            size: a.size,
            gzip: a.gzip,
            path: a.path
          }))
        }
      };
    } catch (err) {
      results.tests.getPackageExportSizes = {
        success: false,
        error: err.message
      };
    }

  } catch (err) {
    results.error = err.message;
  }

  console.log(JSON.stringify(results, null, 2));
}

const packageName = process.argv[2];
if (!packageName) {
  console.error('Package name required');
  process.exit(1);
}

runTests(packageName).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
EOF
}

# Function to create test runner for local version
create_local_test_runner() {
    cat > "$TEST_RUNNER_LOCAL" << 'EOF'
const pkg = require('../../../build/index.js');

async function runTests(packageName) {
  const results = {
    package: packageName,
    version: 'local',
    timestamp: new Date().toISOString(),
    tests: {}
  };

  try {
    // Test 1: getPackageStats
    console.error(`Testing getPackageStats for ${packageName}...`);
    try {
      const stats = await pkg.getPackageStats(packageName);
      results.tests.getPackageStats = {
        success: true,
        data: {
          size: stats.size,
          gzip: stats.gzip,
          dependencyCount: stats.dependencyCount,
          dependencySizes: stats.dependencySizes,
          hasJSModule: stats.hasJSModule,
          hasJSNext: stats.hasJSNext,
          hasSideEffects: stats.hasSideEffects,
          isModuleType: stats.isModuleType,
          peerDependencies: stats.peerDependencies,
          assets: stats.assets.map(a => ({
            name: a.name,
            type: a.type,
            size: a.size,
            gzip: a.gzip
          }))
        }
      };
    } catch (err) {
      results.tests.getPackageStats = {
        success: false,
        error: err.message
      };
    }

    // Test 2: getAllPackageExports
    console.error(`Testing getAllPackageExports for ${packageName}...`);
    try {
      const exports = await pkg.getAllPackageExports(packageName);
      results.tests.getAllPackageExports = {
        success: true,
        data: {
          exportCount: Object.keys(exports).length,
          exports: exports
        }
      };
    } catch (err) {
      results.tests.getAllPackageExports = {
        success: false,
        error: err.message
      };
    }

    // Test 3: getPackageExportSizes
    console.error(`Testing getPackageExportSizes for ${packageName}...`);
    try {
      const exportSizes = await pkg.getPackageExportSizes(packageName);
      results.tests.getPackageExportSizes = {
        success: true,
        data: {
          size: exportSizes.size,
          gzip: exportSizes.gzip,
          assets: exportSizes.assets.map(a => ({
            name: a.name,
            type: a.type,
            size: a.size,
            gzip: a.gzip,
            path: a.path
          }))
        }
      };
    } catch (err) {
      results.tests.getPackageExportSizes = {
        success: false,
        error: err.message
      };
    }

  } catch (err) {
    results.error = err.message;
  }

  console.log(JSON.stringify(results, null, 2));
}

const packageName = process.argv[2];
if (!packageName) {
  console.error('Package name required');
  process.exit(1);
}

runTests(packageName).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
EOF
}

# Create test runners
create_published_test_runner
create_local_test_runner

# Function to test a package
test_package() {
    local package_name=$1
    local safe_name=$(echo "$package_name" | sed 's/[@\/]/_/g')
    
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║ Testing: ${package_name}${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    
    # Test with published version
    echo -e "${YELLOW}Running tests with PUBLISHED version...${NC}"
    cd "$RESULT_DIR"
    npx --yes package-build-stats@latest node "$TEST_RUNNER_PUBLISHED" "$package_name" > "${safe_name}_published.json" 2>&1 || true
    echo -e "${GREEN}✓ Published version tests completed${NC}"
    
    # Test with local version
    echo -e "${YELLOW}Running tests with LOCAL version...${NC}"
    node "$TEST_RUNNER_LOCAL" "$package_name" > "${safe_name}_local.json" 2>&1 || true
    echo -e "${GREEN}✓ Local version tests completed${NC}"
    
    echo ""
}

# Process each package
for package in "$@"; do
    test_package "$package"
done

# Create comparison report
REPORT_FILE="$RESULT_DIR/comparison-report.md"

cat > "$REPORT_FILE" << EOF
# Package Build Stats Comparison Report

**Date:** $(date)
**Published Version:** $PUBLISHED_VERSION
**Local Version:** HEAD

## Packages Tested

EOF

for package in "$@"; do
    safe_name=$(echo "$package" | sed 's/[@\/]/_/g')
    echo "- \`$package\`" >> "$REPORT_FILE"
done

echo "" >> "$REPORT_FILE"
echo "## Results" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

# Create a simple Node.js script to generate comparison
cat > "$RESULT_DIR/generate-comparison.js" << 'EOF'
const fs = require('fs');
const path = require('path');

const files = fs.readdirSync('.').filter(f => f.endsWith('.json'));
const packages = new Set();

files.forEach(f => {
  const match = f.match(/(.+)_(published|local)\.json/);
  if (match) packages.add(match[1]);
});

packages.forEach(pkg => {
  const publishedFile = `${pkg}_published.json`;
  const localFile = `${pkg}_local.json`;
  
  console.log(`\n### Package: \`${pkg.replace(/_/g, '@')}\`\n`);
  
  if (fs.existsSync(publishedFile) && fs.existsSync(localFile)) {
    const published = JSON.parse(fs.readFileSync(publishedFile, 'utf8'));
    const local = JSON.parse(fs.readFileSync(localFile, 'utf8'));
    
    console.log('#### getPackageStats\n');
    if (published.tests?.getPackageStats?.success && local.tests?.getPackageStats?.success) {
      const pubData = published.tests.getPackageStats.data;
      const locData = local.tests.getPackageStats.data;
      
      console.log('| Metric | Published | Local | Diff |');
      console.log('|--------|-----------|-------|------|');
      console.log(`| Size | ${pubData.size} | ${locData.size} | ${locData.size - pubData.size} |`);
      console.log(`| Gzip | ${pubData.gzip} | ${locData.gzip} | ${locData.gzip - pubData.gzip} |`);
      console.log(`| Dependencies | ${pubData.dependencyCount} | ${locData.dependencyCount} | ${locData.dependencyCount - pubData.dependencyCount} |`);
      console.log(`| Has JSModule | ${pubData.hasJSModule} | ${locData.hasJSModule} | - |`);
      console.log(`| Assets Count | ${pubData.assets.length} | ${locData.assets.length} | ${locData.assets.length - pubData.assets.length} |`);
    } else {
      console.log('❌ One or both versions failed\n');
    }
    
    console.log('\n#### getAllPackageExports\n');
    if (published.tests?.getAllPackageExports?.success && local.tests?.getAllPackageExports?.success) {
      const pubData = published.tests.getAllPackageExports.data;
      const locData = local.tests.getAllPackageExports.data;
      
      console.log('| Metric | Published | Local | Diff |');
      console.log('|--------|-----------|-------|------|');
      console.log(`| Export Count | ${pubData.exportCount} | ${locData.exportCount} | ${locData.exportCount - pubData.exportCount} |`);
    } else {
      console.log('❌ One or both versions failed\n');
    }
    
    console.log('\n#### getPackageExportSizes\n');
    if (published.tests?.getPackageExportSizes?.success && local.tests?.getPackageExportSizes?.success) {
      const pubData = published.tests.getPackageExportSizes.data;
      const locData = local.tests.getPackageExportSizes.data;
      
      console.log('| Metric | Published | Local | Diff |');
      console.log('|--------|-----------|-------|------|');
      console.log(`| Size | ${pubData.size} | ${locData.size} | ${locData.size - pubData.size} |`);
      console.log(`| Gzip | ${pubData.gzip} | ${locData.gzip} | ${locData.gzip - pubData.gzip} |`);
      console.log(`| Assets Count | ${pubData.assets.length} | ${locData.assets.length} | ${locData.assets.length - pubData.assets.length} |`);
    } else {
      console.log('❌ One or both versions failed\n');
    }
  } else {
    console.log('❌ Missing result files\n');
  }
});
EOF

# Generate comparison
cd "$RESULT_DIR"
node generate-comparison.js >> "$REPORT_FILE"

echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Comparison completed!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Results saved to:${NC}"
echo -e "  ${YELLOW}$RESULT_DIR${NC}"
echo ""
echo -e "${BLUE}Files generated:${NC}"
for package in "$@"; do
    safe_name=$(echo "$package" | sed 's/[@\/]/_/g')
    echo -e "  - ${safe_name}_published.json"
    echo -e "  - ${safe_name}_local.json"
done
echo -e "  - comparison-report.md"
echo ""
echo -e "${BLUE}View report:${NC}"
echo -e "  cat $REPORT_FILE"
echo ""
