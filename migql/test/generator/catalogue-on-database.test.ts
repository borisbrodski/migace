import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { compare, differencesText } from '@migace/core';
import { generateSteps } from '../../generators/postgresql/index.js';
import { isDoEntry } from '../../src/generated/ast.js';
import { partsOf } from '../../src/model/snippet.js';
import { createMigql } from '../support.js';
import { createBookshopDatabase } from './database.js';

const CATALOGUE = fileURLToPath(new URL('../../constructs', import.meta.url));
const EFFECTS = fileURLToPath(new URL('./effects', import.meta.url));

const { parse } = createMigql();
const { bookshop, run, model } = createBookshopDatabase();

/** The valid examples of the catalogue as `construct/file`. */
const examples = fs.readdirSync(CATALOGUE, { withFileTypes: true }).filter(entry => entry.isDirectory()).flatMap(construct =>
    fs.readdirSync(path.join(CATALOGUE, construct.name, 'dsls')).filter(file => file.endsWith('.migql.yaml')).sort()
        .map(file => `${construct.name}/${file.replace('.migql.yaml', '')}`));

/**
 * What an example needs in addition to the bookshop of release 1.0.0, for example a table of a later release.
 * It stands in `constructs/<construct>/setup/<example>.sql`.
 */
function setupOf(example: string): string[] {
    const [construct, name] = example.split('/');
    const file = path.join(CATALOGUE, construct, 'setup', `${name}.sql`);
    return fs.existsSync(file) ? [fs.readFileSync(file, 'utf8')] : [];
}

// M3-AC-17, M3-AC-18
describe('The generated PostgreSQL of the catalogue on a database', () => {
    test.each(examples)('%s runs, and the schema changes as the construct promises', async example => {
        const [construct, name] = example.split('/');
        const document = await parse(fs.readFileSync(path.join(CATALOGUE, construct, 'dsls', `${name}.migql.yaml`), 'utf8'));
        await bookshop(...setupOf(example));
        const before = await model();

        // M3.2-AC-04: do runs what was written, as one statement.
        for (const each of partsOf(document.parseResult.value).filter(candidate => candidate.entries.some(isDoEntry))) {
            expect(generateSteps(each)).toHaveLength(1);
        }

        await run(document.parseResult.value);

        const change = differencesText(compare(before, await model()));
        await expect(change).toMatchFileSnapshot(path.join(EFFECTS, construct, `${name}.txt`));
    });
});
