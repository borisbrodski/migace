import { describe, expect, test } from 'vitest';
import { createMigql, lines } from '../support.js';

const { tokens, positions, lexerErrors } = createMigql();

function inPart(...body: string[]): string {
    return lines('parts:', '  - p:', ...body.map(line => (line.length > 0 ? '      ' + line : line)));
}

const PART_START = ['parts:', 'INDENT()', 'DASH(-)', 'NAME(p)', ':', 'INDENT()'];
const PART_END = ['DEDENT()', 'DEDENT()'];

// M1-AC-12, M1-AC-13
describe('Lexer: literal blocks', () => {
    test('a statement in a literal block gives the same tokens as on one line', () => {
        const oneLine = tokens(inPart('do: alter table orders'));
        const block = tokens(inPart('do: |', '  alter table orders'));

        expect(block).toEqual(oneLine);
        expect(block).toEqual([...PART_START, 'do:', 'alter', 'table', 'ID(orders)', 'EOL()', ...PART_END]);
    });

    test('a statement in a block may span lines and be indented freely', () => {
        expect(tokens(inPart('do: |', '  alter', '        table', '', '    orders'))).toEqual([
            ...PART_START, 'do:', 'alter', 'table', 'ID(orders)', 'EOL()', ...PART_END,
        ]);
    });

    test('the block ends where the indentation falls back to the key', () => {
        expect(tokens(inPart('do: |', '  alter', 'do: table'))).toEqual([
            ...PART_START, 'do:', 'alter', 'EOL()', 'do:', 'table', 'EOL()', ...PART_END,
        ]);
    });

    test('tokens in a block know their place in the file', () => {
        expect(positions('parts:\n  - p:\n      do: |\n        alter\n          table\n').slice(6)).toEqual([
            'do:@3:7+20', 'alter@4:9+34', 'table@5:11+50', '@5:16+55', '@6:1+56', '@6:1+56',
        ]);
    });

    test('a comment after the block sign is allowed', () => {
        expect(tokens(inPart('do: | # why', '  alter'))).toEqual([...PART_START, 'do:', 'alter', 'EOL()', ...PART_END]);
    });

    test('a -- comment inside a block is not part of the statement', () => {
        expect(tokens(inPart('do: |', '  alter -- the table', '  -- a whole line', '  table'))).toEqual([
            ...PART_START, 'do:', 'alter', 'table', 'EOL()', ...PART_END,
        ]);
    });

    test('a block without lines is an empty value', () => {
        expect(tokens(inPart('do: |', 'do: x'))).toEqual([
            ...PART_START, 'do:', 'EOL()', 'do:', 'ID(x)', 'EOL()', ...PART_END,
        ]);
    });

    test('a character the statement language does not know is an error at its place', () => {
        expect(lexerErrors(inPart('do: |', '  alter ~ table'))).toEqual([
            'Unexpected character "~".@4:15+1',
        ]);
    });
});

// M1-AC-11
describe('Lexer: free text', () => {
    test('the value of doc is one TEXT token, whatever it contains', () => {
        expect(tokens("doc: Customers can't review (yet); 100% sure\n")).toEqual([
            'doc:', "TEXT(Customers can't review (yet); 100% sure)", 'EOL()',
        ]);
    });

    test('a doc in a literal block is one TEXT token over all its lines', () => {
        expect(tokens('doc: |\n  First line.\n    Second line.\nuid: A\n')).toEqual([
            'doc:', 'TEXT(First line.\n    Second line.)', 'EOL()', 'uid:', 'WORD(A)', 'EOL()',
        ]);
    });
});

// M1-AC-19
describe('Lexer: references to parts and releases', () => {
    test('after ran comes the reference to a part as one token', () => {
        expect(tokens('when: ran order-status.link-status\n')).toEqual([
            'when:', 'ran', 'PART_REF(order-status.link-status)', 'EOL()',
        ]);
    });

    test('after from comes the release as one token', () => {
        expect(tokens('when: not ran repair-2.or-not from 1.2.0-rc1 and true\n')).toEqual([
            'when:', 'not', 'ran', 'PART_REF(repair-2.or-not)', 'from', 'RELEASE(1.2.0-rc1)', 'and', 'true', 'EOL()',
        ]);
    });

    test('elsewhere a minus is a minus and from is followed by a table', () => {
        expect(tokens('when: exists (select a-b.c from orders)\n')).toEqual([
            'when:', 'exists', '(', 'select', 'ID(a)', '-', 'ID(b)', '.', 'ID(c)', 'from', 'ID(orders)', ')', 'EOL()',
        ]);
    });
});

// M1-AC-20
describe('Lexer: lists of checks', () => {
    test('each check is a list item with a quantifier as its key', () => {
        expect(tokens(inPart('verify-after:', '  - all: true', '  - none: false'))).toEqual([
            ...PART_START, 'verify-after:', 'INDENT()',
            'DASH(-)', 'all:', 'true', 'EOL()', 'DASH(-)', 'none:', 'false', 'EOL()',
            'DEDENT()', ...PART_END,
        ]);
    });
});

// M1-AC-05
describe('Lexer: flow maps', () => {
    test('a flow map on one line is read with the tokens of the statement language', () => {
        expect(tokens("testdata:\n  - table: orders\n    row: { status: 'shipped ', total_cents: 100 }\n")).toEqual([
            'testdata:', 'INDENT()', 'DASH(-)', 'table:', 'ID(orders)', 'EOL()',
            'row:', '{', 'NAME(status)', ':', "STRING('shipped ')", ',', 'NAME(total_cents)', ':', 'INT(100)', '}', 'EOL()',
            'DEDENT()',
        ]);
    });

    test('a list item may be a flow map', () => {
        expect(tokens(inPart('insert:', '  rows:', '    - { id: 1 }', '    - { id: 2 }'))).toEqual([
            ...PART_START, 'insert:', 'INDENT()', 'rows:', 'INDENT()',
            'DASH(-)', '{', 'NAME(id)', ':', 'INT(1)', '}', 'EOL()',
            'DASH(-)', '{', 'NAME(id)', ':', 'INT(2)', '}', 'EOL()',
            'DEDENT()', 'DEDENT()', ...PART_END,
        ]);
    });
});

// M1-AC-14
describe('Lexer: one-line values that YAML would read differently', () => {
    const ADVICE = ' Use a literal block: write | after the key and the value on the lines below it.';

    test('a # inside a text in quotes would be read as a comment', () => {
        expect(lexerErrors(inPart("do: update t set a = 'x # y'"))).toEqual([
            `YAML reads " #" as the start of a comment, so the rest of the line would be lost.${ADVICE}@3:31+1`,
        ]);
    });

    test('a colon followed by a space is not allowed in a one-line value', () => {
        expect(lexerErrors(inPart("do: update t set a = 'x: y'"))).toEqual([
            `YAML does not allow ": " inside a value that stands on the line of its key.${ADVICE}@3:30+1`,
        ]);
        expect(lexerErrors('doc: Note: this is new\n')).toEqual([
            `YAML does not allow ": " inside a value that stands on the line of its key.${ADVICE}@1:10+1`,
        ]);
    });

    test.each(["'", '"', '@', '`', '%', '[', ']', '}', ','])('a value cannot start with %s', character => {
        expect(lexerErrors(`when: ${character}text\n`)).toEqual([
            `YAML reads a value that starts with ${character} differently.${ADVICE}@1:7+1`,
        ]);
    });

    test('a value that is one text in quotes means the same in YAML', () => {
        expect(tokens("let:\n  a: 'it''s'\n")).toEqual(['let:', 'INDENT()', 'NAME(a)', ':', "STRING('it''s')", 'EOL()', 'DEDENT()']);
        expect(lexerErrors("let:\n  a: 'x' || 'y'\n")).toEqual([
            `YAML reads a value that starts with ' differently.${ADVICE}@2:6+1`,
        ]);
    });

    test('the same values are accepted in a literal block', () => {
        expect(lexerErrors(inPart('do: |', "  update t set a = 'x # y: z'"))).toEqual([]);
        expect(lexerErrors("doc: |\n  'Note': this is new # really\n")).toEqual([]);
    });

    test('a comment after a complete statement is still a comment', () => {
        expect(lexerErrors(inPart("do: update t set a = 'x' # why"))).toEqual([]);
    });

    test('a flow map keeps its colons', () => {
        expect(lexerErrors("testdata:\n  - table: t\n    row: { a: 'x', b: 2 }\n")).toEqual([]);
    });
});

// M1.1-AC-03
describe('Lexer: line endings', () => {
    test('a file with Windows line endings gives the same tokens', () => {
        const text = inPart('do: |', '  update orders', "     set note = 'a'", '', 'when: true') + 'doc: |\n  One.\n  Two.\n';

        const windows = tokens(text.replace(/\n/g, '\r\n'));

        // A text over several lines keeps its line endings in the token. Its value has none, see the parser tests.
        expect(windows.map(token => token.replace(/\r/g, ''))).toEqual(tokens(text));
        expect(lexerErrors(text.replace(/\n/g, '\r\n'))).toEqual([]);
    });
});

// M1.1-AC-15
describe('Lexer: free text in quotes', () => {
    test.each(['doc', 'changed', 'retired'])('the text of %s may not start with a quote', key => {
        expect(lexerErrors(`${key}: 'A text'\n`)).toEqual([
            'Free text is not put in quotes. Remove the quotes, or use a literal block: write | after the key and the text on the lines below it.@1:' + (key.length + 3) + '+1',
        ]);
        expect(lexerErrors(`${key}: "A text"\n`)).toHaveLength(1);
    });

    test.each(['stop', 'todo'])('the text of %s may not start with a quote', key => {
        expect(lexerErrors(inPart(`${key}: 'A text'`))).toEqual([
            'Free text is not put in quotes. Remove the quotes, or use a literal block: write | after the key and the text on the lines below it.@3:' + (key.length + 9) + '+1',
        ]);
    });

    test('a quote inside the text and a quoted text in a literal block are accepted', () => {
        expect(lexerErrors("doc: It's fine\n")).toEqual([]);
        expect(lexerErrors("doc: |\n  'Quoted' text\n")).toEqual([]);
    });
});

// M1.1-AC-17
describe('Lexer: a list at the indentation of its key', () => {
    test('is one error at its first item, and the lines after the list are read', () => {
        const text = 'parts:\n- first:\n    do: delete from t\n- second:\n    do: delete from u\nuid: A\n';

        expect(lexerErrors(text)).toEqual([
            'A list is indented below its key. Indent this line and the other lines of the list.@2:1+1',
        ]);
        expect(tokens(text)).toEqual(['parts:', 'uid:', 'WORD(A)', 'EOL()']);
    });

    test('is also found below a nested key', () => {
        expect(lexerErrors(inPart('do: delete from t', 'verify-after:', '- all: true'))).toEqual([
            'A list is indented below its key. Indent this line and the other lines of the list.@5:7+1',
        ]);
    });
});

// M1.1-AC-16
describe('Lexer: names in double quotes', () => {
    test('a name in double quotes is one token', () => {
        expect(tokens(inPart('do: |', '  update "order" set "Mixed Case" = 1'))).toEqual([
            ...PART_START, 'do:', 'update', 'QUOTED_ID("order")', 'set', 'QUOTED_ID("Mixed Case")', '=', 'INT(1)', 'EOL()', ...PART_END,
        ]);
    });
});

// M1.1-AC-11
describe('Lexer: a list of names on one line', () => {
    test('is read with the tokens of the statement language', () => {
        expect(lexerErrors(inPart('upsert:', '  key: [book_id, currency]'))).toEqual([]);
        expect(tokens(inPart('upsert:', '  key: [book_id, currency]')).slice(8, 15)).toEqual(['key:', '[', 'ID(book_id)', ',', 'ID(currency)', ']', 'EOL()']);
    });
});

// M3.1-AC-15
describe('Lexer: a column name in double quotes as a key', () => {
    test('is a name where the keys are columns', () => {
        expect(tokens(inPart('insert:', '  values:', '    "Line Item": 3', '    Code: 1')).slice(8, 18)).toEqual([
            'values:', 'INDENT()', 'NAME("Line Item")', ':', 'INT(3)', 'EOL()', 'NAME(Code)', ':', 'INT(1)', 'EOL()',
        ]);
        expect(lexerErrors("testdata:\n  - table: t\n    row:\n      \"Line Item\": 3\n")).toEqual([]);
    });

    test('stays an error everywhere else', () => {
        expect(lexerErrors('"uid": A\n')).toEqual(['Quoted keys are not part of MigQL. Write the key without quotes.@1:1+5']);
        expect(lexerErrors('let:\n  "a b": true\n')).toEqual(['Quoted keys are not part of MigQL. Write the key without quotes.@2:3+5']);
    });

    test('a value that is one name in double quotes means the same in YAML', () => {
        expect(tokens(inPart('insert:', '  into: "Order Status"')).slice(8, 11)).toEqual(['into:', 'QUOTED_ID("Order Status")', 'EOL()']);
    });
});
