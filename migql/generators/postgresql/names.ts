/**
 * Words that PostgreSQL does not accept as a name without quotes: its reserved key words,
 * including those that may only name a function or a type.
 */
const RESERVED = new Set(`
    all analyse analyze and any array as asc asymmetric authorization binary both case cast check collate collation
    column concurrently constraint create cross current_catalog current_date current_role current_schema current_time
    current_timestamp current_user default deferrable desc distinct do else end except false fetch for foreign freeze
    from full grant group having ilike in initially inner intersect into is isnull join lateral leading left like limit
    localtime localtimestamp natural not notnull null offset on only or order outer overlaps placing primary references
    returning right select session_user similar some symmetric system_user table tablesample then to trailing true
    union unique user using variadic verbose when where window with
`.split(/\s+/).filter(word => word.length > 0));

const PLAIN = /^[a-z_][a-z0-9_]*$/;

/**
 * A name as it is written in PostgreSQL. A name in MigQL is exact, so it is written in double quotes
 * wherever PostgreSQL would read it differently without them: upper-case letters, a reserved word,
 * other characters. A plain lower-case name needs none.
 */
export function name(exact: string): string {
    return PLAIN.test(exact) && !RESERVED.has(exact) ? exact : `"${exact.replace(/"/g, '""')}"`;
}

/** A text as a PostgreSQL literal. A quote inside it is doubled, so the text cannot end the literal. */
export function text(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
}
