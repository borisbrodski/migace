import { describe, expect, test } from 'vitest';
import { isLetEntry, isNameRef, isWhenEntry } from '../../src/generated/ast.js';
import { createMigql, error, lines } from '../support.js';

const { parse, parseMarked } = createMigql();

const NAME = 'migration: 20260302-0900-x';

// M1-AC-19, M1-AC-21
describe('Linking: names defined under let', () => {
    test('a name in a condition is linked to its definition', async () => {
        const document = await parse(lines(NAME, 'when: has_old_status', 'let:', '  has_old_status: true'));

        const snippet = document.parseResult.value;
        const condition = snippet.entries.filter(isWhenEntry)[0].condition;
        const definition = snippet.entries.filter(isLetEntry)[0].definitions[0];
        expect(isNameRef(condition) && condition.target.ref).toBe(definition);
    });

    test('a definition may use another definition', async () => {
        const parsed = await parseMarked(lines(NAME, 'let:', '  a: true', '  b: not a', '  c: a or b', 'when: c'));

        expect(parsed).toHaveNoIssues();
    });

    test('a name that let does not define is an error', async () => {
        const parsed = await parseMarked(lines(NAME, 'let:', '  audited: true', 'when: audited and <<{|buggy|}>>'));

        expect(parsed).toHaveDocumentIssues([
            error('Unknown condition "buggy". Define it under "let", or check the spelling. Defined here: audited.', 0),
        ]);
    });

    test('without any let the message says how to define one', async () => {
        const parsed = await parseMarked(lines(NAME, 'when: <<{|buggy|}>>'));

        expect(parsed).toHaveDocumentIssues([
            error('Unknown condition "buggy". Define it under "let", or check the spelling.', 0),
        ]);
    });

    test('a name in the condition of a part is linked too', async () => {
        const parsed = await parseMarked(lines(NAME, 'parts:', '  - p:', '      when: <<{|buggy|}>>', '      do: update t set c = 1'));

        expect(parsed).toHaveDocumentIssues([
            error('Unknown condition "buggy". Define it under "let", or check the spelling.', 0),
        ]);
    });
});

describe('Linking: names of columns', () => {
    test('a name inside a statement is a column and is not looked up', async () => {
        const parsed = await parseMarked(lines(NAME, 'parts:', '  - p:', '      do: update t set c = d where e = 1'));

        expect(parsed).toHaveNoIssues();
    });

    test('a name inside a subquery of a condition is a column', async () => {
        const parsed = await parseMarked(lines(NAME, 'when: exists (select 1 from orders where ship_by is null)'));

        expect(parsed).toHaveNoIssues();
    });

    test('a column with the name of a definition stays a column', async () => {
        const document = await parse(lines(NAME, 'let:', '  status: true', 'parts:', '  - p:', '      do: update t set c = status'));

        const references = document.references.map(reference => reference.$refText);
        expect(references).toEqual([]);
    });
});

// M1-AC-21
describe('Validation: definitions that refer to themselves', () => {
    test('a definition that uses itself is an error', async () => {
        const parsed = await parseMarked(lines(NAME, 'let:', '  a: not <<{|a|}>>'));

        expect(parsed).toHaveDocumentIssues([error('The condition "a" refers to itself: a → a.', 0)]);
    });

    test('a definition that uses itself through others is an error at every step', async () => {
        const parsed = await parseMarked(lines(NAME, 'let:', '  a: <<{|b|}>>', '  b: true and <<{|c|}>>', '  c: <<{|a|}>>', '  d: a'));

        expect(parsed).toHaveDocumentIssues([
            error('The condition "a" refers to itself: a → b → c → a.', 0),
            error('The condition "b" refers to itself: b → c → a → b.', 1),
            error('The condition "c" refers to itself: c → a → b → c.', 2),
        ]);
    });
});
