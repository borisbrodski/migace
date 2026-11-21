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
 * The name as the database knows it. A name without quotes is not case-sensitive, and
 * PostgreSQL stores it in lower case. A name in double quotes is kept as it is written.
 */
export function plain(written: string): string {
    return written.startsWith('"') ? written.slice(1, -1) : written.toLowerCase();
}

/** A name as it is written in PostgreSQL: in double quotes only where PostgreSQL would read it differently without. */
export function quoted(plainName: string): string {
    return PLAIN.test(plainName) && !RESERVED.has(plainName) ? plainName : `"${plainName.replace(/"/g, '""')}"`;
}

/** The PostgreSQL form of a name as the author wrote it in a snippet. */
export function name(written: string): string {
    return quoted(plain(written));
}

/** A text as a PostgreSQL literal. A quote inside it is doubled, so the text cannot end the literal. */
export function text(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
}
