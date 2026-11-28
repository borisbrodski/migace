import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const source = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/**
 * All tests of "npm test" in one run, for the coverage and for the mutation tests.
 * The packages are measured together: the script of databases/postgresql, for example, is tested from migql/.
 * The limits are the levels that are reached now. Raise them when the coverage rises; never lower them without a reason.
 */
export default defineConfig({
    resolve: {
        alias: {
            '@migace/core': source('core/src/index.ts'),
            '@migace/postgresql': source('databases/postgresql/src/index.ts'),
        },
    },
    test: {
        include: ['core/test/**/*.test.ts', 'migql/test/**/*.test.ts', 'databases/postgresql/test/**/*.test.ts'],
        // The tests in test/server start a real PostgreSQL. They run with "npm run test:server".
        exclude: ['**/test/server/**', '**/node_modules/**'],
        // Measuring makes the tests on PGlite slower.
        testTimeout: 30000,
        coverage: {
            provider: 'v8',
            include: ['core/src/**/*.ts', 'migql/src/**/*.ts', 'migql/generators/**/*.ts', 'databases/postgresql/src/**/*.ts'],
            exclude: [
                // Written by Langium from the grammar.
                'migql/src/generated/**',
                // Starts a real PostgreSQL. Its tests are in the server stage, "npm run test:server".
                'databases/postgresql/src/temporary-server.ts',
                '**/*.d.ts',
            ],
            reporter: ['text-summary', 'json-summary', 'html'],
            reportsDirectory: 'coverage',
            // Since Vitest 4 the branches are counted from the syntax tree, not from V8's byte ranges.
            // The same code gave 95.4 % with Vitest 2 and gives 93.9 % now.
            thresholds: { lines: 99, statements: 99, functions: 99, branches: 93 },
        },
    },
});
