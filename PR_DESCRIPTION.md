# Major Refactor: Modernize Build System, Add CLI, and Expand Package Manager Support

## 🎯 Overview

This PR represents a comprehensive modernization of the package-build-stats library, introducing significant improvements across build tooling, testing infrastructure, and core functionality. The changes enable better performance, broader package manager support, and improved developer experience.

## 📋 Key Changes

### 🔧 Build System Modernization

- **Migrated from Jest to Vitest** for faster test execution and better ESM support
- **Upgraded to Yarn v4** with corepack for modern package management
- **Added Oxlint** for faster code linting
- **Migrated from Webpack to Rspack** bundler for improved build performance
- **Updated Node.js requirement** to 20.0.0+ for latest features and security
- Removed Babel (no longer needed with modern Node.js)

### 🖥️ CLI Implementation

- **New command-line interface** with yargs for robust argument parsing
- Support for multiple commands (stats, compare, etc.)
- Debug mode for dependency size tree exploration
- Bundler selection options (Rspack/Webpack)
- All package managers supported (npm, yarn, pnpm, bun)

### 📦 Expanded Package Manager Support

- **Bun support** with significantly improved installation performance (13x faster)
- **pnpm support** for efficient disk space usage and stricter dependency management
- Refactored installation utilities to support multiple package managers
- Comprehensive documentation for all supported package managers

### 🧪 Test Infrastructure Overhaul

- Reorganized tests into `fast/` and `slow/` directories for better organization
- Migrated all tests to TypeScript + Vitest
- **Added 40+ comprehensive test fixtures** covering:
  - Basic modules (CJS, ESM, mixed)
  - Complex dependency scenarios (nested, peer, deep)
  - Error handling cases
  - Export patterns and strategies
  - Style processing (CSS/SCSS)
- Custom matchers and test utilities for better test authoring
- Significantly improved test coverage and reliability

### 🔍 Core Feature Improvements

- Enhanced **dependency size tree debugging** capabilities
- Improved **export size calculation** accuracy
- Better package stats aggregation and reporting
- Updated telemetry tracking for usage insights

### 📊 Comparison & Benchmarking Tools

- New scripts for comparing package sizes across versions
- Top packages analysis tools for real-world testing
- Performance benchmarking utilities
- Quick-compare utility for rapid testing
- Comprehensive documentation for all scripts

### 🎨 Type System Modernization

- Reorganized types to `src/types/` directory
- Expanded `PackageManager` type to include pnpm and bun
- Updated option types for new features
- Improved type safety across the codebase

## 🔄 Migration Guide

### For Users

- **Node.js 20+** is now required (update your environment)
- New package managers available: Use `--packageManager bun` or `--packageManager pnpm` for faster installs
- CLI is now available: `npx package-build-stats <package-name>`

### For Contributors

- **Install dependencies** with `yarn install` (Yarn v4)
- **Run tests** with `npm test` (now using Vitest)
- **Linting** now uses Oxlint for faster feedback
- Tests are organized in `tests/fast/` and `tests/slow/` directories

## 📊 Impact

### Performance Improvements

- ✅ Faster test execution with Vitest
- ✅ Faster builds with Rspack
- ✅ Faster installs with Bun support (13x improvement)
- ✅ Faster linting with Oxlint

### Developer Experience

- ✅ CLI for easier package analysis
- ✅ Better test organization and coverage
- ✅ Improved debugging capabilities
- ✅ Comprehensive comparison tools

### Reliability

- ✅ TypeScript tests for better type safety
- ✅ 40+ new test fixtures
- ✅ Better error handling and reporting
- ✅ More robust dependency resolution

## 🧩 Commit Structure

This PR contains 9 logical commits, each focusing on a specific theme:

1. `build: upgrade build tooling and modernize dev dependencies`
2. `feat: add command-line interface for package-build-stats`
3. `refactor: modernize types and expand package manager support`
4. `build: migrate from Webpack to Rspack bundler`
5. `feat: add support for Bun and pnpm package managers`
6. `feat: improve dependency tree calculation and export analysis`
7. `test: reorganize tests and migrate to Vitest`
8. `scripts: add comprehensive package comparison tooling`
9. `chore: update dependencies`

## ✅ Testing

- ✅ All existing tests migrated and passing
- ✅ New test fixtures cover edge cases
- ✅ CI workflow updated and passing
- ✅ Real-world package testing with top-100 packages
- ✅ Cross-package-manager compatibility verified

## 📝 Documentation

- ✅ README updated with new package manager options
- ✅ CLI usage documented
- ✅ Scripts documentation added
- ✅ Test fixtures documented
- ✅ Migration guide included

## 🔗 Related Issues

<!-- Add any related Jira issues or GitHub issues here -->

- Project: https://hello.atlassian.com/devsphere

## 🚀 Breaking Changes

⚠️ **Node.js 20.0.0+ is now required** - Users on older Node versions will need to upgrade

## 📸 Screenshots / Examples

```bash
# New CLI usage
npx package-build-stats react --packageManager bun

# Debug mode for dependency exploration
npx package-build-stats lodash --debug

# Compare package versions
./scripts/compare-versions.sh react@17.0.0 react@18.0.0
```

## 🙏 Acknowledgments

This refactor sets the foundation for future improvements and positions the library for modern JavaScript ecosystem requirements.

---

**Review Checklist:**

- [ ] Code changes reviewed
- [ ] Tests passing
- [ ] Documentation updated
- [ ] Breaking changes communicated
- [ ] Migration path clear
