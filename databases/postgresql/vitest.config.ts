import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        // Tests use the sources of core/, so that core/ does not have to be built first.
        alias: { '@migace/core': fileURLToPath(new URL('../../core/src/index.ts', import.meta.url)) },
    },
    test: {
        include: ['test/**/*.test.ts'],
        // The tests in test/server start a real PostgreSQL. They run with "npm run test:server".
        exclude: ['test/server/**'],
    },
});
