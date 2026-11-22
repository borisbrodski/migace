import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { knownType, TYPES } from '../../src/types.js';

// M3.1-AC-07, M3.1-AC-08
describe('Types that MigQL knows', () => {
    test('the list in the vault is the list of the code', () => {
        const note = fs.readFileSync(fileURLToPath(new URL('../../../MIG-Ace-vault/migql/types.md', import.meta.url)), 'utf8');
        const listed = [...note.matchAll(/^\| `([a-z]+)` \| [^|]+ \| `[a-z]+` \|$/gm)].map(row => row[1]);

        expect(listed).toEqual(Object.keys(TYPES));
    });

    test('a type of the list is found whatever its case', () => {
        expect(knownType('VARCHAR')).toBe('varchar');
        expect(knownType('Integer')).toBe('integer');
        expect(knownType('bigint')).toBe('bigint');
    });

    test('any other name is a type of the schema', () => {
        expect(knownType('Mood')).toBeUndefined();
        expect(knownType('loyalty_level')).toBeUndefined();
    });
});
