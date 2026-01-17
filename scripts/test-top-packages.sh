#!/bin/bash

# Script to test top NPM packages with package-build-stats
# This will compare published version vs local HEAD for the most popular packages

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Testing Top 20 NPM Packages                            ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Top 20 packages based on download stats and dependencies
TOP_PACKAGES=(
    # Utilities
    "lodash"
    "chalk"
    "debug"
    "commander"
    "uuid"
    "async"
    "dotenv"
    "semver"
    "ms"
    
    # Frontend
    "react"
    "react-dom"
    "vue"
    "next"
    "prop-types"
    
    # Build & Types
    "typescript"
    "tslib"
    "webpack"
    "@babel/core"
    
    # Backend
    "express"
    
    # HTTP
    "axios"
)

echo -e "${GREEN}Packages to test (${#TOP_PACKAGES[@]}):${NC}"
for pkg in "${TOP_PACKAGES[@]}"; do
    echo "  - $pkg"
done
echo ""

# Ask for confirmation
read -p "Do you want to test all these packages? This may take a while. (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Run the comparison script
echo -e "${YELLOW}Starting comparison...${NC}"
echo ""

"$SCRIPT_DIR/compare-versions.sh" "${TOP_PACKAGES[@]}"

echo ""
echo -e "${GREEN}✓ All tests completed!${NC}"
