import { ACTIONS } from '../actions/catalogue.js';

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
    /** Set where the lines below the key are the items of a list. */
    list?: boolean;
    /** The words the value may be, where it is one of a fixed set. */
    words?: readonly string[];
    /**
     * What a YAML parser sees in the value, where that is more exact than "any single value":
     * a text, `true` or `false`, or one name or a list of names.
     */
    yaml?: 'text' | 'boolean' | 'names';
    /**
     * A key that is no longer allowed. The lexer still reads it, so that the check can say what to write
     * instead of "unknown key". The schema for editors leaves it out.
     */
    removed?: true;
}

export interface Context {
    /** The fixed keys of this place. */
    keys?: Record<string, KeySpec>;
    /** Set where the author chooses the keys, such as part names. */
    names?: KeySpec;
    /** Set where a list item is a flow map: `- { id: 1 }`. */
    flowItems?: boolean;
    /** Set where the keys are names of columns. Such a key may stand in double quotes: `"Line Item": 3`. */
    quotedNames?: boolean;
    /** The keys that must be there. */
    required?: readonly string[];
}

const word: KeySpec = { value: 'word' };
const text: KeySpec = { value: 'text' };
const statement: KeySpec = { value: 'statement' };

/** One line per column: the name of the column and its value. */
const columns: Context = { names: statement, quotedNames: true };

const insert: Context = {
    keys: {
        into: statement,
        values: { children: columns },
        rows: { children: { flowItems: true }, list: true },
    },
    required: ['into'],
};

const upsert: Context = {
    keys: {
        into: statement,
        key: { value: 'statement', yaml: 'names' },
        rows: { children: { flowItems: true }, list: true },
    },
    required: ['into', 'key', 'rows'],
};

const checks: Context = {
    keys: {
        all: statement,
        none: statement,
        exists: statement,
        single: statement,
    },
};

/** The parameters of an action, one per line. Which ones an action has is checked later, with a better message. */
const actionParameters: Context = { names: statement };

export const partBody: Context = {
    keys: {
        'do': { value: 'statement', yaml: 'text' },
        ...Object.fromEntries(ACTIONS.map(action => [action.name, { value: 'statement', children: actionParameters } satisfies KeySpec])),
        'insert': { children: insert },
        'upsert': { children: upsert },
        'native': { children: { names: text } },
        'stop': text,
        'when': statement,
        'verify-before': { value: 'statement', children: checks, list: true },
        'verify-after': { value: 'statement', children: checks, list: true },
        'batch': statement,
        'expect-rows': statement,
        'phase': { value: 'statement', words: ['finish'] },
        'todo': text,
        'retired': text,
    },
};

const testRow: Context = {
    keys: {
        table: statement,
        as: statement,
        fill: { value: 'statement', words: ['all', 'required'] },
        row: { value: 'statement', children: columns },
    },
};

export const snippetContext: Context = {
    keys: {
        'migration': word,
        'repair': word,
        'uid': word,
        'doc': text,
        'when': { value: 'statement', removed: true },
        'let': { children: { names: statement } },
        'parts': { children: { names: { children: partBody } }, list: true },
        'testdata': { children: testRow, list: true },
        'testdata-before': { children: testRow, list: true },
        'changed': text,
        'retired': text,
        'requires-downtime': { value: 'statement', yaml: 'boolean' },
    },
};
