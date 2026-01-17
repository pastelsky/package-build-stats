#!/bin/bash

# Quick CLI-based comparison using the package-stats CLI
# Usage: ./quick-compare.sh <package1> <package2> ...
# Example: ./quick-compare.sh lodash react axios

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

echo -e "${BLUE}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Quick CLI Comparison: Published vs Local            ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""

if [ $# -eq 0 ]; then
    echo -e "${RED}Error: No packages specified${NC}"
    echo "Usage: $0 <package1> <package2> ..."
    echo "Example: $0 lodash react@18.2.0"
    exit 1
fi

# Build local version
echo -e "${YELLOW}Building local version...${NC}"
cd "$PROJECT_ROOT"
corepack yarn build > /dev/null 2>&1
echo -e "${GREEN}✓ Build completed${NC}"
echo ""

# Get published version
PUBLISHED_VERSION=$(npm view package-build-stats version 2>/dev/null || echo "unknown")

for package in "$@"; do
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}Testing: $package${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    # Test with published version
    echo -e "${YELLOW}📦 Published version ($PUBLISHED_VERSION):${NC}"
    echo "$ npx package-build-stats stats $package"
    echo ""
    npx --yes package-build-stats@latest stats "$package" 2>&1 | head -30 || true
    echo ""
    echo -e "${YELLOW}Press Enter to continue to local version...${NC}"
    read
    
    # Test with local version  
    echo -e "${YELLOW}🔧 Local version (HEAD):${NC}"
    echo "$ node build/index.js (stats for $package)"
    echo ""
    
    # Use the built local version via node
    node -e "
    const pkg = require('$PROJECT_ROOT/build/index.js');
    (async () => {
      try {
        const result = await pkg.getPackageStats('$package');
        console.log(JSON.stringify(result, null, 2));
      } catch (err) {
        console.error('Error:', err.message);
      }
    })();
    " 2>&1 | head -30 || true
    
    echo ""
    echo -e "${YELLOW}Press Enter to continue to next package...${NC}"
    read
    echo ""
done

echo -e "${GREEN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Comparison Complete                                  ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════╝${NC}"
