import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const source = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
    resolve: {
        // The tests on a database use the sources of the other packages, so that nothing has to be built first.
        alias: {
            '@migace/core': source('../core/src/index.ts'),
            '@migace/postgresql': source('../databases/postgresql/src/index.ts'),
        },
    },
    test: {
        include: ['test/**/*.test.ts'],
        // The tests in test/server start a real PostgreSQL. They run with "npm run test:server".
        exclude: ['test/server/**'],
        // The first start of a database in memory takes several seconds on a slow build computer.
        testTimeout: 30_000,
    },
});
