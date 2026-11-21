import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe } from 'vitest';
import { defaultInitWorkspace, langiumGeneratorSuite } from 'langium-tools/testing';
import { generateSnippet } from '../../generators/postgresql/index.js';
import type { Snippet } from '../../src/generated/ast.js';
import { createMigqlServices } from '../../src/migql-module.js';

const CATALOGUE = fileURLToPath(new URL('../../constructs', import.meta.url));

/**
 * The expected SQL of every construct is committed in `constructs/<construct>/generated/postgresql/`,
 * and `generated-metadata.json` lists the files.
 *
 * `npm test` compares what the generator produces with those files.
 * `npm run test:generate` rewrites them; the change is then reviewed as a diff.
 */
describe('Catalogue: generated PostgreSQL', () => {
    langiumGeneratorSuite(CATALOGUE, {
        createServices: createMigqlServices,
        // Only the valid examples are generated. The invalid ones must not even be loaded.
        initWorkspace: (services, construct) => defaultInitWorkspace(services, path.join(construct, 'dsls')),
        generateForModel: async (_services, model, output) => generateSnippet(model as Snippet, output),
    });
});
