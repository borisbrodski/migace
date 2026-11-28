import { describe, expect, test } from 'vitest';
import { DocumentIssueSource, getDocumentIssues } from 'langium-tools/base';
import { createMigql, error, lines } from '../support.js';

const { parseMarked } = createMigql();

function part(...body: string[]): string {
    return lines('migration: 20260302-0900-x', 'parts:', '  - p:', ...body.map(line => '      ' + line));
}

async function expectErrors(text: string, ...messages: string[]): Promise<void> {
    const parsed = await parseMarked(text);
    expect(parsed).toHaveDocumentIssues(messages.map((message, marker) => error(message, marker)));
}

describe('Parser: one issue per problem', () => {
    test('a syntax error is reported once, by the parser, with its whole range', async () => {
        const { document } = await parseMarked(part('do: update t set <<{|=|}>> 1'));
        const issues = getDocumentIssues(document);
        expect(issues).toHaveLength(1);
        expect(issues[0]).toMatchObject({
            source: DocumentIssueSource.PARSER,
            message: 'Expected a name, but found "=".',
            endLine: issues[0].startLine,
            endColumn: issues[0].startColumn + 1,
        });
    });
});

// M1-AC-26
describe('Parser: messages say what was expected', () => {
    test('a name is missing', async () => {
        await expectErrors(part('do: update t set <<{|=|}>> 1'), 'Expected a name, but found "=".');
    });

    test('a bracket is not closed', async () => {
        await expectErrors(part('do: update t set c = (1<<{||}>>'), 'Expected ")", but the value ends here.');
    });

    test('a value is missing', async () => {
        await expectErrors(part('do: update t set c =<<{||}>>'), 'Expected a value, but the value ends here.');
    });

    test('a statement is missing', async () => {
        await expectErrors(part('do:<<{||}>>'),
            'Expected "create", "alter", "drop", "update", "delete" or "insert", but the value ends here.');
    });

    test('something follows a complete statement', async () => {
        await expectErrors(part('do: update t set c = 1 <<{|extra|}>> words'),
            'Unexpected "extra". The value is complete before it.');
    });

    test('a keyword stands where a name is expected', async () => {
        await expectErrors(part('do: alter table <<{|select|}>> add column c integer'), 'Expected a name, but found "select". "select" is a keyword. To use it as a name, write it in double quotes: "select".');
    });

    test('a type is missing', async () => {
        await expectErrors(part('do: alter table t add column c <<{|not|}>> null'), 'Expected a name, but found "not". "not" is a keyword. To use it as a name, write it in double quotes: "not".');
    });

    test('a list is expected below a key', async () => {
        await expectErrors(lines('migration: 20260302-0900-x', 'parts:', '<<{|uid:|}>> A'),
            'Expected an indented block, but found "uid".');
    });

    test('a character that the statement language does not know', async () => {
        await expectErrors(part('do: update t set c = 1 <<{|~|}>> <<{|2|}>>'),
            'Unexpected character "~".', 'Unexpected "2". The value is complete before it.');
    });
});

// M1-AC-27
describe('Parser: one error does not hide the next', () => {
    test('two broken parts are both reported', async () => {
        await expectErrors(lines(
            'migration: 20260302-0900-x',
            'parts:',
            '  - first:',
            '      do: update t set <<{|=|}>> 1',
            '  - second:',
            '      do: update t set c = 2',
            '  - third:',
            '      do: delete <<{|orders|}>>',
            '      when: 1 +<<{||}>>',
        ), 'Expected a name, but found "=".', 'Expected "from", but found "orders".', 'Expected a value, but the value ends here.');
    });
});

// M1-AC-28
describe('Parser: errors inside a literal block', () => {
    test('an error is reported at its place in the file', async () => {
        await expectErrors(part(
            'do: |',
            '  update orders',
            '     set status_id = (select s.id <<{|form|}>> order_status)',
            '   where status_id is null',
        ), 'Expected "from", but found "form".');
    });

    test('a block that ends too early is reported at its last character', async () => {
        await expectErrors(part('do: |', '  update orders', '  set<<{||}>>', 'when: true'), 'Expected a name, but the value ends here.');
    });
});
