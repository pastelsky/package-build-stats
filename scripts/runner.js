
const path = require('path');
const { getPackageStats, getPackageExportSizes } = require('../build/index');

async function run() {
    const packageString = process.argv[2];
    if (!packageString) {
        process.exit(1);
    }

    const overallStart = Date.now();

    try {
        // We use debug: true to prevent cleanup of the install directory so we can copy artifacts later
        const statsStart = Date.now();
        const stats = await getPackageStats(packageString, { debug: true });
        const statsTimeMs = Date.now() - statsStart;

        const exportsStart = Date.now();
        const exportSizes = await getPackageExportSizes(packageString, { debug: true });
        const exportsTimeMs = Date.now() - exportsStart;

        const totalTimeMs = Date.now() - overallStart;

        const result = {
            size: stats.size,
            gzip: stats.gzip,
            dependencySizes: stats.dependencySizes || [],
            exports: (exportSizes.assets || []).map(a => ({
                name: a.name,
                size: a.size,
                gzip: a.gzip
            })),
            timing: {
                statsTimeMs,
                exportsTimeMs,
                totalTimeMs
            },
            // Capture install paths if available (custom mod)
            installPath: stats.installPath,
            exportsInstallPath: exportSizes.installPath
        };

        process.stdout.write('---RESULT_START---' + '\n');
        process.stdout.write(JSON.stringify(result, null, 2) + '\n');
        process.stdout.write('---RESULT_END---' + '\n');
    } catch (error) {
        process.stderr.write('Analysis failed: ' + error.message + '\n');
        process.exit(1);
    }
}

run();
