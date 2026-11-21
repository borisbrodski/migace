import { describe, expect, test } from 'vitest';
import { createMigql } from '../support.js';

const { tokens, lexerErrors, partialTokens } = createMigql();

describe('Lexer: envelope', () => {
    test('a key with a word value is a key token, a WORD and an EOL', () => {
        expect(tokens('migration: 20260302-0900-customer-loyalty\n')).toEqual([
            'migration:', 'WORD(20260302-0900-customer-loyalty)', 'EOL()',
        ]);
    });

    test('nested keys open and close with INDENT and DEDENT, a list item starts with DASH', () => {
        expect(tokens([
            'migration: 20260302-0900-customer-loyalty',
            'uid: 01JF2A6QW3ZK8M4T7R9B5X0C1D',
            '',
            'parts:',
            '  - add-column:',
            '      do: alter',
            '',
        ].join('\n'))).toEqual([
            'migration:', 'WORD(20260302-0900-customer-loyalty)', 'EOL()',
            'uid:', 'WORD(01JF2A6QW3ZK8M4T7R9B5X0C1D)', 'EOL()',
            'parts:', 'INDENT()',
            'DASH(-)', 'NAME(add-column)', ':', 'INDENT()',
            'do:', 'alter', 'EOL()',
            'DEDENT()', 'DEDENT()',
        ]);
    });
});

// M1-AC-02
describe('Lexer: comments and blank lines', () => {
    test('comment lines and blank lines between entries produce no tokens', () => {
        expect(tokens('# first\n\nuid: A\n   # indented comment\n\nuid: B\n')).toEqual([
            'uid:', 'WORD(A)', 'EOL()', 'uid:', 'WORD(B)', 'EOL()',
        ]);
    });

    test('a comment after a value ends the value', () => {
        expect(tokens('uid: A # the identity\n')).toEqual(['uid:', 'WORD(A)', 'EOL()']);
    });

    test('a comment after a key without value is ignored', () => {
        expect(tokens('parts: # all parts\n  - p:\n      do: alter   # why\n')).toEqual([
            'parts:', 'INDENT()', 'DASH(-)', 'NAME(p)', ':', 'INDENT()', 'do:', 'alter', 'EOL()', 'DEDENT()', 'DEDENT()',
        ]);
    });

    test('a # without a space before it belongs to the value', () => {
        expect(tokens('uid: A#B\n')).toEqual(['uid:', 'WORD(A#B)', 'EOL()']);
    });
});

// M1-AC-03
describe('Lexer: tabs', () => {
    test('a tab in the indentation is an error at the tab', () => {
        expect(lexerErrors('parts:\n  \t- p:\n')).toEqual([
            'Tab in the indentation. Indent with spaces only.@2:3+1',
        ]);
    });

    test('the line with the tab produces no tokens', () => {
        expect(tokens('uid: A\n\tuid: B\n')).toEqual(['uid:', 'WORD(A)', 'EOL()']);
    });
});

// M1-AC-04
describe('Lexer: YAML that MigQL does not support', () => {
    test.each([
        ['uid: &id A', 'Anchors (&name) are not part of MigQL. Write the value out.@1:6+3'],
        ['uid: *id', 'Aliases (*name) are not part of MigQL. Repeat the value.@1:6+3'],
        ['uid: !!str A', 'Tags (!name) are not part of MigQL. Remove the tag.@1:6+5'],
        ['uid: >', 'Folded blocks (>) are not part of MigQL. Use a literal block (|).@1:6+1'],
        ['---', 'Several documents in one file are not part of MigQL. Write one snippet per file.@1:1+3'],
        ['"uid": A', 'Quoted keys are not part of MigQL. Write the key without quotes.@1:1+5'],
        ['uid: A\n  B C', 'A value over several lines needs a literal block: put | after the key and indent the lines below it.@2:3+3'],
        ['uid: A\n= B', 'Expected a key followed by a colon.@2:1+3'],
    ])('%s', (text, error) => {
        expect(lexerErrors(text + '\n')).toEqual([error]);
    });

    test('an entry with an error produces no tokens, and the lines after it are read', () => {
        expect(tokens('uid: &id A\nuid: B\n')).toEqual(['uid:', 'WORD(B)', 'EOL()']);
    });
});

// M1-AC-06
describe('Lexer: unknown keys', () => {
    test('an unknown key is an error that lists the allowed keys', () => {
        expect(lexerErrors('colour: red\n')).toEqual([
            expect.stringMatching(/^Unknown key "colour"\. Allowed here: migration, repair, uid, .*\.@1:1\+6$/),
        ]);
    });

    test('the lines below an unknown key are skipped with it', () => {
        const text = 'colour:\n  shade: dark\n  tone:\n    - x\nuid: A\n';

        expect(lexerErrors(text)).toHaveLength(1);
        expect(tokens(text)).toEqual(['uid:', 'WORD(A)', 'EOL()']);
    });
});

describe('Lexer: positions', () => {
    const { positions } = createMigql();

    test('every token knows its line, column and offset in the file', () => {
        expect(positions('uid: A\nparts:\n  - p:\n      do: alter\n')).toEqual([
            'uid:@1:1+0', 'A@1:6+5', '@1:7+6',
            'parts:@2:1+7', '@3:3+16',
            '-@3:3+16', 'p@3:5+18', ':@3:6+19', '@4:7+27',
            'do:@4:7+27', 'alter@4:11+31', '@4:16+36',
            '@5:1+37', '@5:1+37',
        ]);
    });
});

describe('Lexer: a word without a colon', () => {
    test('is a name, so that the parser can say which keys fit and the editor can complete it', () => {
        expect(tokens('uid: A\nver\n')).toEqual(['uid:', 'WORD(A)', 'EOL()', 'NAME(ver)']);
        expect(lexerErrors('uid: A\nver\n')).toEqual([]);
    });
});

describe('Lexer: text that ends at the cursor', () => {
    test('a value that is still typed is not closed', () => {
        expect(partialTokens('parts:\n  - p:\n      do: delete from')).toEqual([
            'parts:', 'INDENT()', 'DASH(-)', 'NAME(p)', ':', 'INDENT()', 'do:', 'delete', 'from',
        ]);
    });

    test('a key without value is not closed', () => {
        expect(partialTokens('parts:\n  - p:\n      do: ')).toEqual([
            'parts:', 'INDENT()', 'DASH(-)', 'NAME(p)', ':', 'INDENT()', 'do:',
        ]);
    });

    test('an indented empty last line opens the block that may start there', () => {
        expect(partialTokens('parts:\n  - p:\n      ')).toEqual(['parts:', 'INDENT()', 'DASH(-)', 'NAME(p)', ':', 'INDENT()']);
    });

    test('an empty last line closes the blocks that end before it', () => {
        expect(partialTokens('parts:\n  - p:\n      do: delete from t\n')).toEqual([
            'parts:', 'INDENT()', 'DASH(-)', 'NAME(p)', ':', 'INDENT()', 'do:', 'delete', 'from', 'ID(t)', 'EOL()', 'DEDENT()', 'DEDENT()',
        ]);
        expect(partialTokens('parts:\n  - p:\n      do: delete from t\n  ')).toEqual([
            'parts:', 'INDENT()', 'DASH(-)', 'NAME(p)', ':', 'INDENT()', 'do:', 'delete', 'from', 'ID(t)', 'EOL()', 'DEDENT()',
        ]);
    });

    test('a literal block that is still typed is not closed', () => {
        expect(partialTokens('parts:\n  - p:\n      do: |\n        delete\n          from')).toEqual([
            'parts:', 'INDENT()', 'DASH(-)', 'NAME(p)', ':', 'INDENT()', 'do:', 'delete', 'from',
        ]);
    });
});
