#!/bin/bash

# Script to fetch and display top npm packages with their download statistics
# This helps you choose which packages to test

set -e

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Top NPM Packages - Download Statistics                 ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

# List of popular packages to check
PACKAGES=(
    # Utilities - Most Depended
    "lodash"
    "chalk"
    "debug"
    "commander"
    "uuid"
    "async"
    "dotenv"
    "semver"
    "ms"
    "yargs"
    
    # Frontend Frameworks
    "react"
    "react-dom"
    "vue"
    "next"
    "@angular/core"
    "svelte"
    
    # State Management & Props
    "prop-types"
    "redux"
    "zustand"
    
    # Build Tools
    "typescript"
    "tslib"
    "webpack"
    "@babel/core"
    "esbuild"
    "vite"
    "rollup"
    
    # Backend
    "express"
    "fastify"
    "koa"
    
    # HTTP Clients
    "axios"
    "node-fetch"
    "got"
    
    # Testing
    "jest"
    "mocha"
    "vitest"
    "@testing-library/react"
    
    # Linting & Formatting
    "eslint"
    "prettier"
    
    # CSS-in-JS
    "styled-components"
    "@emotion/react"
    
    # Date/Time
    "moment"
    "date-fns"
    "dayjs"
    
    # Validation
    "zod"
    "yup"
    "joi"
    
    # Types
    "@types/node"
    "@types/react"
)

echo -e "${YELLOW}Fetching download statistics (last week)...${NC}"
echo ""

# Create a temp file for results
TEMP_FILE=$(mktemp)

# Fetch stats for each package
for pkg in "${PACKAGES[@]}"; do
    echo -n "."
    STATS=$(curl -s "https://api.npmjs.org/downloads/point/last-week/$pkg" 2>/dev/null || echo '{"downloads":0}')
    DOWNLOADS=$(echo "$STATS" | jq -r '.downloads // 0')
    echo "$DOWNLOADS|$pkg" >> "$TEMP_FILE"
done

echo ""
echo ""

# Sort and display top 30
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Top 30 Packages by Weekly Downloads                      ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""

printf "${CYAN}%-5s %-40s %15s${NC}\n" "Rank" "Package" "Weekly Downloads"
printf "${CYAN}%-5s %-40s %15s${NC}\n" "----" "-------" "----------------"

sort -t'|' -k1 -nr "$TEMP_FILE" | head -30 | awk -F'|' '{
    printf "%-5d %-40s %15s\n", NR, $2, $1
}' | while read line; do
    echo -e "${NC}$line"
done

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Generate a file with top 20 for easy use
OUTPUT_FILE="$(dirname "$0")/top-20-packages.txt"
sort -t'|' -k1 -nr "$TEMP_FILE" 2>/dev/null | head -20 | awk -F'|' '{print $2}' > "$OUTPUT_FILE" 2>/dev/null || true

# Clean up
rm "$TEMP_FILE"

echo -e "${BLUE}Top 20 packages saved to: ${YELLOW}$OUTPUT_FILE${NC}"
echo ""
echo -e "${BLUE}To test these packages, run:${NC}"
echo -e "  ${YELLOW}./compare-versions.sh \$(cat top-20-packages.txt)${NC}"
echo ""
