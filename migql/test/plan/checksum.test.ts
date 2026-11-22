import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { partChecksums } from '../../src/checksum/checksum.js';
import { createMigql, lines } from '../support.js';

const { services } = createMigql();

function checksums(text: string): Record<string, string> {
    return Object.fromEntries(partChecksums(services.migql.parser.Lexer.tokenize(text).tokens));
}

function checksum(...body: string[]): string {
    return checksums(lines('migration: 20260302-0900-x', 'parts:', '  - p:', ...body.map(line => '      ' + line))).p;
}

const UPDATE = ['do: |', "  update orders o set status = upper(trim(o.status)) where o.id > 10 and o.status <> 'x  y'"];

// M4.1-AC-06
describe('Checksum of a part, rule v1', () => {
    test('is written with the version of its rule', () => {
        expect(checksum(...UPDATE)).toMatch(/^v1:[0-9a-f]{64}$/);
    });

    test('every part of a snippet has its own', () => {
        const all = checksums(lines('migration: 20260302-0900-x', 'parts:', '  - first:', '      do: delete from a', '  - second:', '      do: delete from b', '  - third:', '      do: delete from a'));

        expect(Object.keys(all)).toEqual(['first', 'second', 'third']);
        expect(all.first).not.toBe(all.second);
        expect(all.third).toBe(all.first);
    });

    test.each([
        ['more white space', ['do: |', "  update   orders o", "     set status = upper( trim( o.status ) )", '', "   where o.id > 10 and o.status <> 'x  y'"]],
        ['one line', ["do: update orders o set status = upper(trim(o.status)) where o.id > 10 and o.status <> 'x  y'"]],
        ['comments', ['do: |', '  -- why this is needed', "  update orders o set status = upper(trim(o.status)) -- tidy", "  where o.id > 10 and o.status <> 'x  y'"]],
        ['a YAML comment', ["do: update orders o set status = upper(trim(o.status)) where o.id > 10 and o.status <> 'x  y' # tidy"]],
        ['keywords in another case', ['do: |', "  UPDATE orders o SET status = upper(trim(o.status)) WHERE o.id > 10 AND o.status <> 'x  y'"]],
    ])('%s does not change it', (_what, body) => {
        expect(checksum(...body)).toBe(checksum(...UPDATE));
    });

    test.each([
        ['a name', "update orders o set status = upper(trim(o.Status)) where o.id > 10 and o.status <> 'x  y'"],
        ['a name in quotes', "update orders o set \"status\" = upper(trim(o.status)) where o.id > 10 and o.status <> 'x  y'"],
        ['the case of a function', "update orders o set status = Upper(trim(o.status)) where o.id > 10 and o.status <> 'x  y'"],
        ['a number', "update orders o set status = upper(trim(o.status)) where o.id > 11 and o.status <> 'x  y'"],
        ['a text', "update orders o set status = upper(trim(o.status)) where o.id > 10 and o.status <> 'x y'"],
        ['an operator', "update orders o set status = upper(trim(o.status)) where o.id >= 10 and o.status <> 'x  y'"],
        ['a keyword', "update orders o set status = upper(trim(o.status)) where o.id > 10 or o.status <> 'x  y'"],
        ['brackets', "update orders o set status = upper(trim(o.status)) where (o.id > 10) and o.status <> 'x  y'"],
    ])('%s changes it', (_what, statement) => {
        expect(checksum('do: |', `  ${statement}`)).not.toBe(checksum(...UPDATE));
    });

    test('the other keys of a part count, the name of the part does not', () => {
        const plain = checksum('do: delete from t');

        expect(checksum('do: delete from t', 'when: true')).not.toBe(plain);
        expect(checksum('do: delete from t', 'verify-after: true')).not.toBe(checksum('do: delete from t', 'verify-before: true'));
        expect(checksums(lines('migration: 20260302-0900-x', 'parts:', '  - other-name:', '      do: delete from t'))['other-name']).toBe(plain);
    });

    test('an action on one line and as a block are two spellings and two checksums', () => {
        expect(checksum('column-rename: { table: customer, from: mail, to: email }'))
            .not.toBe(checksum('column-rename:', '  table: customer', '  from: mail', '  to: email'));
    });

    test('native text is taken as it is, without the white space at the ends of its lines and without its indentation', () => {
        const native = checksum('native:', '  postgresql: |', '    create index ix on book', '      using gin (title)');

        expect(checksum('native:', '  postgresql: |', '        create index ix on book   ', '          using gin (title)')).toBe(native);
        expect(checksum('native:', '  postgresql: |', '    create index ix on book', '    using gin (title)')).not.toBe(native);
        expect(checksum('native:', '  postgresql: |', '    CREATE index ix on book', '      using gin (title)')).not.toBe(native);
    });

    test('white space, comments and the case of keywords never change it', () => {
        const KEYWORDS = /\b(update|set|where|and|is|not|null|select|from|in)\b/g;
        const statement = ['update', 'orders', 'o', 'set', 'status_id', '=', '(', 'select', 's.id', 'from', 'order_status', 's', 'where', "s.code = 'A  b'", ')',
            'where', 'o.status_id', 'is', 'null', 'and', 'o.id', 'not', 'in', '(', '1', ',', '2', ')'];
        const expected = checksum('do: |', `  ${statement.join(' ')}`);

        fc.assert(fc.property(
            fc.array(fc.constantFrom(' ', '  ', '\n        ', ' -- note\n        ', '\n\n          '), { minLength: statement.length, maxLength: statement.length }),
            fc.array(fc.boolean(), { minLength: statement.length, maxLength: statement.length }),
            (gaps, upper) => {
                const text = statement.map((piece, index) => (upper[index] ? piece.replace(KEYWORDS, word => word.toUpperCase()) : piece) + gaps[index]).join('');

                expect(checksum('do: |', `  ${text}`)).toBe(expected);
            }), { seed: 20261122, numRuns: 200 });
    });
});

/** The checksums of every part of the given files, as lines `<file> <part> <checksum>`. */
function listed(folder: string, files: string[]): string[] {
    return files.flatMap(file => Object.entries(checksums(fs.readFileSync(path.join(folder, file), 'utf8')))
        .map(([part, value]) => `${file.replace(/\\/g, '/').replace('.migql.yaml', '')} ${part} ${value}`));
}

// M4.1-AC-41
describe('Checksums that must never change', () => {
    const CATALOGUE = fileURLToPath(new URL('../../constructs', import.meta.url));
    const BOOKSHOP = fileURLToPath(new URL('../../../examples/bookshop/migrations', import.meta.url));
    const LIST = fileURLToPath(new URL('./checksums-v1.txt', import.meta.url));

    const current = [
        ...listed(CATALOGUE, fs.readdirSync(CATALOGUE, { withFileTypes: true }).filter(entry => entry.isDirectory()).flatMap(construct =>
            fs.readdirSync(path.join(CATALOGUE, construct.name, 'dsls')).sort().map(file => path.join(construct.name, 'dsls', file)))),
        ...listed(BOOKSHOP, fs.readdirSync(BOOKSHOP).sort()).map(line => `bookshop/${line}`),
    ];

    test('every part of the catalogue and of the bookshop has the checksum of the committed list', () => {
        const committed = fs.existsSync(LIST) ? fs.readFileSync(LIST, 'utf8').split('\n').filter(line => line.length > 0) : [];
        const known = new Map(committed.map(line => [line.substring(0, line.lastIndexOf(' ')), line]));
        const added = current.filter(line => !known.has(line.substring(0, line.lastIndexOf(' '))));
        // A new example adds a line. No line is ever changed: the generate run only appends.
        if (process.env.GENERATOR_TEST === 'generate' && added.length > 0) {
            fs.writeFileSync(LIST, [...committed, ...added].join('\n') + '\n');
        }

        const list = fs.readFileSync(LIST, 'utf8').split('\n').filter(line => line.length > 0);
        expect(current.filter(line => !list.includes(line))).toEqual([]);
    });
});
