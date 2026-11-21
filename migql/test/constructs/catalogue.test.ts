import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, test } from 'vitest';
import { createMigql, DIAGNOSTICS_ONLY, error } from '../support.js';

/**
 * The catalogue of constructs is the specification of the statement language.
 * Every folder describes one construct, shows snippets that must parse (`dsls/`)
 * and snippets that must fail at a marked place (`invalid/`).
 *
 * An invalid example starts with one `# expect: <message>` line per marker.
 */
const CATALOGUE = fileURLToPath(new URL('../../constructs', import.meta.url));

// M1-AC-15
const REQUIRED = [
    'create-table', 'alter-table-add-column', 'alter-table-drop-column', 'alter-table-alter-column',
    'alter-table-add-constraint', 'create-index', 'drop-table', 'drop-index', 'ensure-column', 'rename-column',
    'update', 'delete', 'insert-values', 'insert-select',
];

const { parse, parseMarked } = createMigql();

function examples(construct: string, kind: 'dsls' | 'invalid'): string[] {
    const folder = path.join(CATALOGUE, construct, kind);
    return fs.existsSync(folder) ? fs.readdirSync(folder).filter(file => file.endsWith('.migql.yaml')).sort() : [];
}

const constructs = [...new Set([...REQUIRED, ...fs.readdirSync(CATALOGUE).filter(name => !name.includes('.'))])];

describe.each(constructs)('Construct %s', construct => {
    const folder = path.join(CATALOGUE, construct);
    const valid = examples(construct, 'dsls');
    const invalid = examples(construct, 'invalid');

    test('is described in construct.md', () => {
        expect(fs.existsSync(path.join(folder, 'construct.md'))).toBe(true);
    });

    test('has at least two valid and two invalid examples', () => {
        expect(valid.length).toBeGreaterThanOrEqual(2);
        expect(invalid.length).toBeGreaterThanOrEqual(2);
    });

    test.each(valid)('dsls/%s parses without problems', async file => {
        const source = path.join(folder, 'dsls', file);
        const document = await parse(fs.readFileSync(source, 'utf8'), {
            documentUri: pathToFileURL(source).toString(),
            validation: true,
        });

        expect(document).toHaveNoIssues();
    });

    test.each(invalid)('invalid/%s fails at the marked places', async file => {
        const text = fs.readFileSync(path.join(folder, 'invalid', file), 'utf8');
        const expected = [...text.matchAll(/^# expect: (.*)$/gm)].map(match => match[1]);
        expect(expected.length).toBeGreaterThan(0);

        const parsed = await parseMarked(text);

        expect(parsed).toHaveDocumentIssues(expected.map((message, marker) => error(message, marker)), DIAGNOSTICS_ONLY);
    });
});
