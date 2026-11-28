import { describe, expect, test } from 'vitest';
import { createMigql, error, lines } from '../support.js';

const { parseMarked, parse, clear } = createMigql();

const NAME = 'migration: 20260302-0900-x';

// M1-AC-06
describe('Validation: name of a snippet', () => {
    test('a snippet without migration or repair is an error at its first key', async () => {
        const parsed = await parseMarked(lines('<<{|uid|}>>: A'));

        expect(parsed).toHaveDocumentIssues([
            error('A snippet needs a name. Add "migration: <name>", or "repair: <name>" for a repair snippet.', 0),
        ]);
    });

    test('migration and repair together is an error at the second', async () => {
        const parsed = await parseMarked(lines(NAME, '<<{|repair|}>>: 20260302-0900-x'));

        expect(parsed).toHaveDocumentIssues([
            error('A snippet has either "migration" or "repair", and only once. Remove this line.', 0),
        ]);
    });
});

// M1-AC-06
describe('Validation: keys that appear twice', () => {
    test('a top-level key that appears twice is an error at the second place', async () => {
        const parsed = await parseMarked(lines(NAME, 'uid: A', 'doc: One', '<<{|uid|}>>: B'));

        expect(parsed).toHaveDocumentIssues([error('The key "uid" appears twice. Keep one of them.', 0)]);
    });

    test('testdata and testdata-before are different keys', async () => {
        const parsed = await parseMarked(lines(NAME, 'testdata:', '  - table: t', 'testdata-before:', '  - table: t'));

        expect(parsed).toHaveNoErrors();
    });

    test('a key that appears twice in a part is an error at the second place', async () => {
        const parsed = await parseMarked(lines(NAME, 'parts:', '  - p:', '      do: update t set c = 1', '      when: true', '      <<{|when|}>>: false'));

        expect(parsed).toHaveDocumentIssues([error('The key "when" appears twice. Keep one of them.', 0)]);
    });
});

// M1-AC-07
describe('Validation: form of the name', () => {
    test.each([
        'review-table', '2026-03-09-review-table', '20260309-review-table', '20260309-1400-', '20260309-1400-Review_Table',
    ])('the name %s is an error', async name => {
        const parsed = await parseMarked(`migration: <<{|${name}|}>>\n`);

        expect(parsed).toHaveDocumentIssues([
            error('The name of a snippet has the form YYYYMMDD-HHMM-slug, for example 20260309-1400-review-table.', 0),
        ]);
    });

    test('the file must be named after the snippet', async () => {
        const document = await parse('migration: 20260309-1400-review-table\n', {
            documentUri: 'file:///migrations/20260309-1400-reviews.migql.yaml',
            validation: true,
        });

        expect(document.diagnostics?.map(diagnostic => diagnostic.message)).toEqual([
            'The file of this snippet must be named "20260309-1400-review-table.migql.yaml". It is named "20260309-1400-reviews.migql.yaml".',
        ]);
    });
});

// M1-AC-08
describe('Validation: one operation per part', () => {
    test('a part without an operation is an error at the part name', async () => {
        const parsed = await parseMarked(lines(NAME, 'parts:', '  - <<{|p|}>>:', '      when: true'));

        expect(parsed).toHaveDocumentIssues([
            error('The part "p" has no operation. Add one of: do, insert, upsert, native, stop, or an action such as column-set-not-null.', 0),
        ]);
    });

    test('a part without a body is an error at the part name', async () => {
        const parsed = await parseMarked(lines(NAME, 'parts:', '  - <<{|p|}>>:'));

        expect(parsed).toHaveDocumentIssues([
            error('The part "p" has no operation. Add one of: do, insert, upsert, native, stop, or an action such as column-set-not-null.', 0),
        ]);
    });

    test('a part with two operations is an error at the part name', async () => {
        const parsed = await parseMarked(lines(NAME, 'parts:', '  - <<{|p|}>>:', '      do: update t set c = 1', '      stop: Call us.'));

        expect(parsed).toHaveDocumentIssues([
            error('The part "p" has 2 operations: do, stop. A part holds exactly one. Move the others into parts of their own.', 0),
        ]);
    });
});

// M1-AC-09
describe('Validation: part names', () => {
    test('a part name that is used twice is an error at the second part', async () => {
        const parsed = await parseMarked(lines(NAME, 'parts:', '  - p:', '      do: update t set c = 1', '  - <<{|p|}>>:', '      do: update t set c = 2'));

        expect(parsed).toHaveDocumentIssues([
            error('The part name "p" is already used in this snippet. Part names must be unique.', 0),
        ]);
    });
});

// M1-AC-10, M1.1-AC-18
describe('Validation: phase', () => {
    test('finish is accepted', async () => {
        const parsed = await parseMarked(lines(NAME, 'parts:', '  - p:', '      do: update t set c = 1', '      phase: finish'));

        expect(parsed).toHaveNoErrors();
    });

    test('any other phase is an error at the value', async () => {
        const parsed = await parseMarked(lines(NAME, 'parts:', '  - p:', '      do: update t set c = 1', '      phase: <<{|start|}>>'));

        expect(parsed).toHaveDocumentIssues([error('Expected "finish", but found "start".', 0)]);
    });
});

// M1.1-AC-18
describe('Validation: requires-downtime', () => {
    test('true and false are accepted, nothing else', async () => {
        expect(await parseMarked(lines(NAME, 'requires-downtime: true'))).toHaveNoErrors();
        await clear();
        expect(await parseMarked(lines(NAME, 'requires-downtime: false'))).toHaveNoErrors();
        await clear();
        expect(await parseMarked(lines(NAME, 'requires-downtime: <<{|yes|}>>'))).toHaveDocumentIssues([
            error('Expected "true" or "false", but found "yes".', 0),
        ]);
    });
});
