#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

// Configuration
const CONCURRENCY = 5;
const SCRIPT_DIR = __dirname;
const PROJECT_ROOT = path.join(SCRIPT_DIR, '..');
const PACKAGE_LIST_FILE = path.join(SCRIPT_DIR, 'top-packages-list.txt');
const MASTER_CACHE_DIR = path.join(SCRIPT_DIR, '.master-cache');

// Colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Command: list
function cmdList() {
  log('╔═══════════════════════════════════════════════════════════╗', 'blue');
  log('║   Top NPM Packages (Static List)                         ║', 'blue');
  log('╚═══════════════════════════════════════════════════════════╝', 'blue');
  console.log();

  if (!fs.existsSync(PACKAGE_LIST_FILE)) {
    log(`Error: Package list not found at ${PACKAGE_LIST_FILE}`, 'red');
    process.exit(1);
  }

  const packages = fs
    .readFileSync(PACKAGE_LIST_FILE, 'utf8')
    .split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.trim());

  log('═══════════════════════════════════════════════════════════', 'green');
  log(`  Top ${packages.length} Packages`, 'green');
  log('═══════════════════════════════════════════════════════════', 'green');
  console.log();

  packages.slice(0, 50).forEach((pkg, i) => {
    console.log(`${(i + 1).toString().padStart(3)}. ${pkg}`);
  });

  if (packages.length > 50) {
    console.log();
    log(`... (showing first 50 of ${packages.length} packages)`, 'green');
  }

  console.log();
  log(`Full list: ${PACKAGE_LIST_FILE}`, 'blue');
  console.log();
}

// Command: test
async function cmdTest(packages) {
  if (!packages || packages.length === 0) {
    log('Error: No packages specified', 'red');
    console.log('Usage: node compare.js test <package1> [package2] ...');
    process.exit(1);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                    new Date().toTimeString().split(' ')[0].replace(/:/g, '');
  const resultDir = path.join(SCRIPT_DIR, 'comparison-results', timestamp);
  fs.mkdirSync(resultDir, { recursive: true });

  log('╔═══════════════════════════════════════════════════════════╗', 'blue');
  log('║   Package Comparison: master vs Local HEAD               ║', 'blue');
  log('╚═══════════════════════════════════════════════════════════╝', 'blue');
  console.log();

  log('Baseline: master branch', 'green');
  log('Local: current HEAD', 'green');
  log(`Testing ${packages.length} package(s) (${CONCURRENCY} at a time)`, 'green');
  console.log();

  // Build local version
  log('Building local version...', 'yellow');
  try {
    execSync('corepack yarn build', { cwd: PROJECT_ROOT, stdio: 'ignore' });
  } catch (e) {
    // Ignore TypeScript errors - build output might still be generated
  }
  
  // Check if build output exists
  if (!fs.existsSync(path.join(PROJECT_ROOT, 'build', 'index.js'))) {
    log('✗ Build failed - no output generated', 'red');
    process.exit(1);
  }
  log('✓ Build completed', 'green');
  console.log();

  // Clone and build master branch once (cached for reuse)
  const masterBuildExists = fs.existsSync(path.join(MASTER_CACHE_DIR, 'build', 'index.js'));
  
  if (masterBuildExists) {
    log('✓ Using cached master branch build', 'green');
  } else {
    log('Cloning and building master branch (this may take 1-2 minutes, only needed once)...', 'yellow');
    try {
      // Remove cache dir if it exists but is incomplete
      if (fs.existsSync(MASTER_CACHE_DIR)) {
        execSync(`rm -rf "${MASTER_CACHE_DIR}"`, { stdio: 'pipe' });
      }
      
      // Clone master branch
      log('  Cloning master branch...', 'yellow');
      execSync(`git clone --branch master --single-branch "${PROJECT_ROOT}" "${MASTER_CACHE_DIR}"`, { stdio: 'pipe', timeout: 120000 });
      
      // Install dependencies and build
      log('  Installing dependencies...', 'yellow');
      execSync('corepack yarn install', { cwd: MASTER_CACHE_DIR, stdio: 'pipe', timeout: 180000 });
      
      log('  Building master...', 'yellow');
      execSync('corepack yarn build', { cwd: MASTER_CACHE_DIR, stdio: 'pipe', timeout: 120000 });
      
      log('✓ Master branch cloned and built', 'green');
    } catch (e) {
      log('✗ Failed to clone/build master branch', 'red');
      log('  Error: ' + e.message, 'red');
      log('  Cannot continue without master build', 'red');
      process.exit(1);
    }
  }
  console.log();

  // Create test runners
  createTestRunners(resultDir, MASTER_CACHE_DIR);

  // Test packages in parallel batches
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('Starting parallel tests...', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  console.log();

  const startTime = Date.now();
  const results = await testPackagesInBatches(packages, resultDir);
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log();
  log('All package tests completed!', 'green');
  console.log();

  // Generate report
  log('Generating comparison report...', 'yellow');
  generateReport(packages, results, resultDir);

  // Print summary
  printSummary(results, resultDir, totalTime);

  console.log();
  log(`Results: ${resultDir}`, 'blue');
  log(`Report:  cat ${path.join(resultDir, 'report.md')}`, 'blue');
  console.log();
}

// Command: top
async function cmdTop(n = 20) {
  if (!fs.existsSync(PACKAGE_LIST_FILE)) {
    log(`Error: Package list not found at ${PACKAGE_LIST_FILE}`, 'red');
    process.exit(1);
  }

  const packages = fs
    .readFileSync(PACKAGE_LIST_FILE, 'utf8')
    .split('\n')
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.trim())
    .slice(0, n);

  log(`Testing top ${packages.length} packages from static list...`, 'blue');
  console.log();
  log(`Will test ${packages.length} packages:`, 'green');
  packages.forEach(pkg => console.log(`  ${pkg}`));
  console.log();

  await cmdTest(packages);
}

// Helper: Create test runner scripts
function createTestRunners(resultDir, masterCacheDir) {
  // Master branch test runner
  const masterRunner = `
const pkg = require('${masterCacheDir}/build/index.js');

async function runTests(packageName) {
  const results = {
    package: packageName,
    version: 'master',
    timestamp: new Date().toISOString(),
    tests: {}
  };

  try {
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
  `;

  // Write master test runner to cache directory
  fs.writeFileSync(path.join(masterCacheDir, 'test-master.js'), masterRunner);

  // Local version test runner
  const localRunner = `
const pkg = require('${PROJECT_ROOT}/build/index.js');

async function runTests(packageName) {
  const results = {
    package: packageName,
    version: 'local',
    timestamp: new Date().toISOString(),
    tests: {}
  };

  try {
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
  `;

  // Write local test runner to result directory only
  fs.writeFileSync(path.join(resultDir, 'test-local.js'), localRunner);
}

// Helper: Test a single package
function testSinglePackage(packageName, resultDir) {
  return new Promise((resolve) => {
    const safeName = packageName.replace(/[@/:]/g, '_');
    const masterFile = path.join(resultDir, `${safeName}_master.json`);
    const localFile = path.join(resultDir, `${safeName}_local.json`);

    let masterDone = false;
    let localDone = false;
    let masterTime = 0;
    let locTime = 0;

    const checkBothDone = () => {
      if (masterDone && localDone) {
        resolve({ 
          package: packageName, 
          safeName,
          masterTime: masterTime,
          localTime: locTime
        });
      }
    };

    // Test with master branch (from cache directory)
    // Use legacy OpenSSL provider for webpack 4 compatibility with Node 20+
    const masterStart = Date.now();
    const masterProc = spawn('node', ['--openssl-legacy-provider', path.join(MASTER_CACHE_DIR, 'test-master.js'), packageName], 
                          { cwd: MASTER_CACHE_DIR, env: process.env });
    
    const masterOutput = [];
    const masterErrors = [];
    masterProc.stdout.on('data', data => masterOutput.push(data));
    masterProc.stderr.on('data', data => masterErrors.push(data));
    masterProc.on('close', () => {
      masterTime = ((Date.now() - masterStart) / 1000).toFixed(2);
      const output = Buffer.concat(masterOutput).toString();
      const errors = Buffer.concat(masterErrors).toString();
      // Write stdout if available, otherwise write error info
      fs.writeFileSync(masterFile, output || JSON.stringify({ 
        error: 'No output', 
        stderr: errors 
      }, null, 2));
      masterDone = true;
      checkBothDone();
    });

    // Test with local version
    const locStart = Date.now();
    const locProc = spawn('node', [path.join(resultDir, 'test-local.js'), packageName], 
                          { cwd: resultDir, env: process.env });
    
    const locOutput = [];
    const locErrors = [];
    locProc.stdout.on('data', data => locOutput.push(data));
    locProc.stderr.on('data', data => locErrors.push(data));
    locProc.on('close', () => {
      locTime = ((Date.now() - locStart) / 1000).toFixed(2);
      const output = Buffer.concat(locOutput).toString();
      const errors = Buffer.concat(locErrors).toString();
      // Write stdout if available, otherwise write error info
      fs.writeFileSync(localFile, output || JSON.stringify({ 
        error: 'No output', 
        stderr: errors 
      }, null, 2));
      localDone = true;
      checkBothDone();
    });
  });
}

// Helper: Test packages in batches
async function testPackagesInBatches(packages, resultDir) {
  const results = [];
  
  for (let i = 0; i < packages.length; i += CONCURRENCY) {
    const batch = packages.slice(i, i + CONCURRENCY);
    
    batch.forEach(pkg => log(`▸ Testing: ${pkg}`, 'yellow'));
    
    const batchResults = await Promise.all(
      batch.map(pkg => testSinglePackage(pkg, resultDir))
    );
    
    results.push(...batchResults);
    
    batchResults.forEach(r => log(`✓ Completed: ${r.package}`, 'green'));
    
    console.log();
    log(`Progress: ${Math.min(i + CONCURRENCY, packages.length)}/${packages.length} packages tested`, 'blue');
    console.log();
  }
  
  return results;
}

// Helper: Generate markdown report
function generateReport(packages, results, resultDir) {
  let report = `# Package Build Stats Comparison Report

**Date:** ${new Date().toISOString()}
**Baseline:** master branch
**Local:** current HEAD

## Packages Tested

${packages.map(pkg => `- \`${pkg}\``).join('\n')}

## Results

`;

  results.forEach(({ safeName }) => {
    const masterFile = path.join(resultDir, `${safeName}_master.json`);
    const locFile = path.join(resultDir, `${safeName}_local.json`);

    if (!fs.existsSync(masterFile) || !fs.existsSync(locFile)) {
      report += `\n### \`${safeName.replace(/_/g, '@')}\`\n\n❌ Missing result files\n\n`;
      return;
    }

    let master, loc;
    try {
      master = JSON.parse(fs.readFileSync(masterFile, 'utf8'));
      loc = JSON.parse(fs.readFileSync(locFile, 'utf8'));
    } catch (e) {
      report += `\n### \`${safeName.replace(/_/g, '@')}\`\n\n❌ Failed to parse results\n\n`;
      return;
    }

    report += `\n### \`${safeName.replace(/_/g, '@')}\`\n\n`;

    // getPackageStats
    report += `#### getPackageStats\n\n`;
    if (master.tests?.getPackageStats?.success && loc.tests?.getPackageStats?.success) {
      const m = master.tests.getPackageStats.data;
      const l = loc.tests.getPackageStats.data;
      report += `| Metric | Master | Local | Diff |\n`;
      report += `|--------|--------|-------|------|\n`;
      report += `| Size | ${m.size} | ${l.size} | ${l.size - m.size} |\n`;
      report += `| Gzip | ${m.gzip} | ${l.gzip} | ${l.gzip - m.gzip} |\n`;
      report += `| Dependencies | ${m.dependencyCount} | ${l.dependencyCount} | ${l.dependencyCount - m.dependencyCount} |\n`;
      report += `| Assets | ${m.assets.length} | ${l.assets.length} | ${l.assets.length - m.assets.length} |\n\n`;
    } else {
      report += `❌ Failed\n\n`;
    }

    // getAllPackageExports
    report += `#### getAllPackageExports\n\n`;
    if (master.tests?.getAllPackageExports?.success && loc.tests?.getAllPackageExports?.success) {
      const m = master.tests.getAllPackageExports.data;
      const l = loc.tests.getAllPackageExports.data;
      report += `| Metric | Master | Local | Diff |\n`;
      report += `|--------|--------|-------|------|\n`;
      report += `| Exports | ${m.exportCount} | ${l.exportCount} | ${l.exportCount - m.exportCount} |\n\n`;
    } else {
      report += `❌ Failed\n\n`;
    }

    // getPackageExportSizes
    report += `#### getPackageExportSizes\n\n`;
    if (master.tests?.getPackageExportSizes?.success && loc.tests?.getPackageExportSizes?.success) {
      const m = master.tests.getPackageExportSizes.data;
      const l = loc.tests.getPackageExportSizes.data;
      report += `| Metric | Master | Local | Diff |\n`;
      report += `|--------|--------|-------|------|\n`;
      report += `| Size | ${m.size} | ${l.size} | ${l.size - m.size} |\n`;
      report += `| Gzip | ${m.gzip} | ${l.gzip} | ${l.gzip - m.gzip} |\n`;
      report += `| Assets | ${m.assets.length} | ${l.assets.length} | ${l.assets.length - m.assets.length} |\n\n`;
    } else {
      report += `❌ Failed\n\n`;
    }
  });

  fs.writeFileSync(path.join(resultDir, 'report.md'), report);
}

// Helper: Print summary
function printSummary(results, resultDir, totalTime) {
  console.log();
  log('╔═══════════════════════════════════════════════════════════╗', 'blue');
  log('║                      TEST SUMMARY                         ║', 'blue');
  log('╚═══════════════════════════════════════════════════════════╝', 'blue');
  console.log();

  const summary = {
    succeeded: [],
    failed: [],
    identical: [],
    different: []
  };

  results.forEach(({ package: pkg, safeName, masterTime, localTime }) => {
    const masterFile = path.join(resultDir, `${safeName}_master.json`);
    const locFile = path.join(resultDir, `${safeName}_local.json`);

    let master, loc;
    let isSuccess = true;
    
    try {
      master = JSON.parse(fs.readFileSync(masterFile, 'utf8'));
      loc = JSON.parse(fs.readFileSync(locFile, 'utf8'));
    } catch (e) {
      summary.failed.push({ pkg, reason: 'Parse error' });
      isSuccess = false;
      return;
    }

    // Check if tests succeeded
    const masterSuccess = master.tests?.getPackageStats?.success &&
                       master.tests?.getAllPackageExports?.success &&
                       master.tests?.getPackageExportSizes?.success;
    const locSuccess = loc.tests?.getPackageStats?.success &&
                       loc.tests?.getAllPackageExports?.success &&
                       loc.tests?.getPackageExportSizes?.success;

    if (!masterSuccess || !locSuccess) {
      summary.failed.push({ 
        pkg, 
        reason: !masterSuccess ? 'Master failed' : 'Local failed',
        masterTime,
        localTime
      });
      return;
    }

    // Compare results (ignore differences < 5%)
    const differences = [];
    const THRESHOLD = 0.05; // 5%

    // Helper to check if difference is significant (>= 5%)
    const isSignificant = (master, local) => {
      if (master === 0 && local === 0) return false;
      if (master === 0 || local === 0) return true; // One is zero, other isn't
      const pctDiff = Math.abs((local - master) / master);
      return pctDiff >= THRESHOLD;
    };

    // Helper to format value for display
    const formatValue = (val) => {
      if (val === null || val === undefined) return 'undefined';
      if (Array.isArray(val)) return `[${val.join(', ')}]`;
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    };

    // Deep comparison function
    const deepCompare = (obj1, obj2, path = '') => {
      const diffs = [];
      
      // Get all unique keys from both objects
      const keys1 = obj1 ? Object.keys(obj1) : [];
      const keys2 = obj2 ? Object.keys(obj2) : [];
      const allKeys = new Set([...keys1, ...keys2]);
      
      for (const key of allKeys) {
        const val1 = obj1?.[key];
        const val2 = obj2?.[key];
        const currentPath = path ? `${path}.${key}` : key;
        
        // Skip if both are undefined
        if (val1 === undefined && val2 === undefined) continue;
        
        // Handle missing keys
        if (val1 === undefined) {
          diffs.push({ path: currentPath, master: 'undefined', local: formatValue(val2), change: '' });
          continue;
        }
        if (val2 === undefined) {
          diffs.push({ path: currentPath, master: formatValue(val1), local: 'undefined', change: '' });
          continue;
        }
        
        // Handle arrays
        if (Array.isArray(val1) && Array.isArray(val2)) {
          // For arrays, do a deep comparison if they're different lengths or contain objects
          if (val1.length !== val2.length) {
            diffs.push({ path: `${currentPath} (length)`, master: String(val1.length), local: String(val2.length), change: '' });
          }
          
          // If array contains primitives, compare as strings
          if (val1.length > 0 && typeof val1[0] !== 'object') {
            const str1 = JSON.stringify(val1.sort());
            const str2 = JSON.stringify(val2.sort());
            if (str1 !== str2) {
              diffs.push({ path: currentPath, master: formatValue(val1), local: formatValue(val2), change: '' });
            }
          } else {
            // For arrays of objects, compare each element
            const maxLen = Math.max(val1.length, val2.length);
            for (let i = 0; i < maxLen; i++) {
              if (i < val1.length && i < val2.length) {
                if (typeof val1[i] === 'object' && typeof val2[i] === 'object') {
                  diffs.push(...deepCompare(val1[i], val2[i], `${currentPath}[${i}]`));
                } else if (val1[i] !== val2[i]) {
                  diffs.push({ path: `${currentPath}[${i}]`, master: formatValue(val1[i]), local: formatValue(val2[i]), change: '' });
                }
              }
            }
          }
          continue;
        }
        
        // Handle objects (recurse)
        if (typeof val1 === 'object' && val1 !== null && typeof val2 === 'object' && val2 !== null) {
          diffs.push(...deepCompare(val1, val2, currentPath));
          continue;
        }
        
        // Handle primitives
        if (val1 !== val2) {
          // Check if both are numbers and if so, check if difference is significant
          if (typeof val1 === 'number' && typeof val2 === 'number') {
            if (isSignificant(val1, val2)) {
              const pct = ((val2 - val1) / val1 * 100).toFixed(1);
              diffs.push({ 
                path: currentPath, 
                master: String(val1), 
                local: String(val2), 
                change: `${pct > 0 ? '+' : ''}${pct}%` 
              });
            }
          } else {
            diffs.push({ path: currentPath, master: formatValue(val1), local: formatValue(val2), change: '' });
          }
        }
      }
      
      return diffs;
    };

    // Use deep comparison for all test data
    if (master.tests && loc.tests) {
      const deepDiffs = deepCompare(master.tests, loc.tests, 'tests');
      
      // Convert deep diffs to display format
      deepDiffs.forEach(diff => {
        // Format the path for better readability
        const path = diff.path
          .replace('tests.', '')
          .replace('.data.', '.')
          .replace(/\[(\d+)\]/g, '[$1]');
        
        differences.push(`${path}: ${diff.master} → ${diff.local}${diff.change ? ' (' + diff.change + ')' : ''}`);
      });
    }

    if (differences.length > 0) {
      summary.different.push({ pkg, differences, masterTime, localTime });
    } else {
      summary.identical.push({ pkg, masterTime, localTime });
    }

    summary.succeeded.push({ pkg, masterTime, localTime });
  });

  // Print statistics
  log(`Total packages tested: ${results.length}`, 'bright');
  log(`Total time: ${totalTime}s`, 'bright');
  console.log();

  // Print succeeded vs failed
  log(`✓ Succeeded: ${summary.succeeded.length}`, summary.succeeded.length > 0 ? 'green' : 'reset');
  log(`✗ Failed: ${summary.failed.length}`, summary.failed.length > 0 ? 'red' : 'reset');
  console.log();

  // Print identical vs different
  log(`═ Identical results: ${summary.identical.length}`, summary.identical.length > 0 ? 'green' : 'reset');
  log(`≠ Different results: ${summary.different.length}`, summary.different.length > 0 ? 'yellow' : 'reset');
  console.log();

  // Show failed packages
  if (summary.failed.length > 0) {
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'red');
    log('FAILED PACKAGES:', 'red');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'red');
    summary.failed.forEach(({ pkg, reason, masterTime, localTime }) => {
      log(`  ✗ ${pkg}`, 'red');
      log(`    Reason: ${reason}`, 'red');
      if (masterTime || localTime) {
        log(`    Time: master=${masterTime || 'N/A'}s, local=${localTime || 'N/A'}s`, 'reset');
      }
    });
    console.log();
  }

  // Show packages with differences
  if (summary.different.length > 0) {
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'yellow');
    log('PACKAGES WITH DIFFERENCES:', 'yellow');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'yellow');
    
    summary.different.forEach(({ pkg, differences, masterTime, localTime }) => {
      log(`\n  Package: ${pkg}`, 'yellow');
      log(`  Time: master=${masterTime}s, local=${localTime}s`, 'reset');
      console.log();
      
      // Display differences in a table format
      if (differences.length > 0) {
        // Parse differences into table rows
        const rows = differences.map(diff => {
          // Parse different formats: "key: val1 → val2" or "key: val1 → val2 (pct%)"
          const match = diff.match(/^([^:]+):\s*(.+?)\s*→\s*(.+?)(?:\s*\(([^)]+)\))?$/);
          if (match) {
            const [, metric, master, local, change] = match;
            return { metric: metric.trim(), master: master.trim(), local: local.trim(), change: change ? change.trim() : '' };
          }
          return { metric: diff, master: '', local: '', change: '' };
        });
        
        // Calculate column widths
        const metricWidth = Math.max(10, ...rows.map(r => r.metric.length));
        const masterWidth = Math.max(8, ...rows.map(r => r.master.length));
        const localWidth = Math.max(8, ...rows.map(r => r.local.length));
        const changeWidth = Math.max(8, ...rows.map(r => r.change.length));
        
        // Print header
        const header = `  ${'Metric'.padEnd(metricWidth)} │ ${'Master'.padEnd(masterWidth)} │ ${'Local'.padEnd(localWidth)} │ ${'Change'.padEnd(changeWidth)}`;
        log(header, 'bright');
        log(`  ${'─'.repeat(metricWidth)}─┼─${'─'.repeat(masterWidth)}─┼─${'─'.repeat(localWidth)}─┼─${'─'.repeat(changeWidth)}`, 'reset');
        
        // Print rows
        rows.forEach(row => {
          const line = `  ${row.metric.padEnd(metricWidth)} │ ${row.master.padEnd(masterWidth)} │ ${row.local.padEnd(localWidth)} │ ${row.change.padEnd(changeWidth)}`;
          log(line, 'yellow');
        });
      }
    });
    console.log();
  }

  // Show identical packages
  if (summary.identical.length > 0) {
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'green');
    log('PACKAGES WITH IDENTICAL RESULTS:', 'green');
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'green');
    summary.identical.forEach(({ pkg, masterTime, localTime }) => {
      log(`  ✓ ${pkg} (master=${masterTime}s, local=${localTime}s)`, 'green');
    });
    console.log();
  }

  // Overall result
  log('═══════════════════════════════════════════════════════════', 'blue');
  if (summary.different.length === 0 && summary.failed.length === 0) {
    log('✓ All tests passed with identical results!', 'green');
  } else if (summary.failed.length > 0) {
    log('✗ Some tests failed', 'red');
  } else {
    log('⚠ All tests passed but some results differ', 'yellow');
  }
  log('═══════════════════════════════════════════════════════════', 'blue');
}

// Main
async function main() {
  const [,, command, ...args] = process.argv;

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║   Package Build Stats - Comparison Tool                  ║
╚═══════════════════════════════════════════════════════════╝

USAGE:
  node compare.js <command> [args]

COMMANDS:
  list                        Display top npm packages (static list)
  test <pkg> [pkg2...]        Test specific packages
  top [N]                     Test top N packages (default: 20)
  help                        Show this help

EXAMPLES:
  node compare.js list
  node compare.js test lodash react axios
  node compare.js test lodash@4.17.21
  node compare.js top 10
  node compare.js top

PERFORMANCE:
  ⚡ Tests run ${CONCURRENCY} packages in parallel for faster results
  ⚡ Master branch cached after first run (saves 1-2 minutes)

CACHE:
  To refresh the master branch cache:
    rm -rf scripts/.master-cache
    `);
    return;
  }

  switch (command) {
    case 'list':
      cmdList();
      break;
    case 'test':
      await cmdTest(args);
      break;
    case 'top':
      await cmdTop(parseInt(args[0]) || 20);
      break;
    default:
      log(`Unknown command: ${command}`, 'red');
      log('Run "node compare.js help" for usage', 'yellow');
      process.exit(1);
  }
}

main().catch(err => {
  log(`Error: ${err.message}`, 'red');
  process.exit(1);
});
