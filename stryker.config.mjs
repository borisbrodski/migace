// Mutation testing: Stryker changes the sources in small ways and runs the tests against every change.
// A change that no test notices "survives": there the tests would not flag a broken implementation.
// Run it with "npm run test:mutation". It takes long and is no part of "npm test".
export default {
    testRunner: 'vitest',
    vitest: { configFile: 'vitest.coverage.config.ts' },
    mutate: [
        'core/src/**/*.ts',
        'databases/postgresql/src/**/*.ts',
        'migql/src/**/*.ts',
        'migql/generators/**/*.ts',
        // Written by Langium from the grammar.
        '!migql/src/generated/**',
        // Written from the construct.md files; a test compares it with them.
        '!migql/src/actions/descriptions.ts',
        // Tested in the server stage, on a real PostgreSQL.
        '!databases/postgresql/src/temporary-server.ts',
    ],
    ignorePatterns: ['website', 'clients/java', 'coverage', 'reports', '**/out'],
    // The tests run through Vite, which does not check types. Without this, Stryker writes a comment into files that a test compares.
    disableTypeChecks: false,
    coverageAnalysis: 'perTest',
    // Every test process starts databases in memory. More processes than this used up the memory of a 16 GB computer.
    concurrency: 4,
    // Changes to code that runs once when a file is loaded would need every test for each change.
    ignoreStatic: true,
    reporters: ['progress', 'json', 'html'],
    jsonReporter: { fileName: 'reports/mutation/mutation.json' },
    htmlReporter: { fileName: 'reports/mutation/mutation.html' },
    tempDirName: '.stryker-tmp',
    timeoutMS: 30000,
    thresholds: { high: 90, low: 80, break: null },
};
