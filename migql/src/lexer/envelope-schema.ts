/**
 * What the lexer has to know about the keys of a snippet: how the value of a key is read
 * and which keys may follow below it. The grammar defines the structure; this table only
 * tells the lexer which kind of tokens to produce.
 */

/**
 * `word`: one name without spaces. `text`: free text, kept as it is.
 * `statement`: tokens of the statement language.
 */
export type ValueKind = 'word' | 'text' | 'statement';

export interface KeySpec {
    value?: ValueKind;
    /** The context of the lines nested below this key. */
    children?: Context;
}

export interface Context {
    /** The fixed keys of this place. */
    keys?: Record<string, KeySpec>;
    /** Set where the author chooses the keys, such as part names. */
    names?: KeySpec;
    /** Set where a list item is a flow map: `- { id: 1 }`. */
    flowItems?: boolean;
}

const word: KeySpec = { value: 'word' };
const text: KeySpec = { value: 'text' };
const statement: KeySpec = { value: 'statement' };

const insert: Context = {
    keys: {
        into: statement,
        values: { children: { names: statement } },
        rows: { children: { flowItems: true } },
    },
};

const upsert: Context = {
    keys: {
        into: statement,
        key: statement,
        rows: { children: { flowItems: true } },
    },
};

const checks: Context = {
    keys: {
        all: statement,
        none: statement,
        exists: statement,
        single: statement,
    },
};

const partBody: Context = {
    keys: {
        'do': statement,
        'insert': { children: insert },
        'upsert': { children: upsert },
        'native': { children: { names: text } },
        'stop': text,
        'when': statement,
        'verify-before': { value: 'statement', children: checks },
        'verify-after': { value: 'statement', children: checks },
        'batch': statement,
        'expect-rows': statement,
        'phase': statement,
        'todo': text,
    },
};

const testRow: Context = {
    keys: {
        table: statement,
        as: statement,
        fill: statement,
        row: { value: 'statement', children: { names: statement } },
    },
};

export const snippetContext: Context = {
    keys: {
        'migration': word,
        'repair': word,
        'uid': word,
        'doc': text,
        'when': statement,
        'let': { children: { names: statement } },
        'parts': { children: { names: { children: partBody } } },
        'testdata': { children: testRow },
        'testdata-before': { children: testRow },
        'changed': text,
        'retired': text,
        'requires-downtime': statement,
    },
};
