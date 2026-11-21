import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadModule, parseSync } from 'libpg-query';
import { beforeAll, describe, expect, test } from 'vitest';

const CATALOGUE = fileURLToPath(new URL('../../constructs', import.meta.url));

const expectedFiles = fs.readdirSync(CATALOGUE, { withFileTypes: true }).filter(entry => entry.isDirectory()).flatMap(construct => {
    const folder = path.join(CATALOGUE, construct.name, 'generated', 'postgresql');
    return fs.existsSync(folder) ? fs.readdirSync(folder).map(file => path.join(construct.name, 'generated', 'postgresql', file)) : [];
});

beforeAll(() => loadModule());

describe('Expected PostgreSQL of the catalogue', () => {
    test('every construct has expected files', () => {
        expect(expectedFiles.length).toBeGreaterThanOrEqual(30);
    });

    // M3-AC-01
    test.each(expectedFiles)('%s is accepted by PostgreSQL\'s own parser', file => {
        const sql = fs.readFileSync(path.join(CATALOGUE, file), 'utf8');

        const parsed = parseSync(sql);

        expect(parsed.stmts!.length).toBeGreaterThan(0);
    });

    // M3-AC-02
    test.each(expectedFiles)('%s is generated completely', file => {
        expect(fs.readFileSync(path.join(CATALOGUE, file), 'utf8')).not.toContain('not generated yet');
    });
});
