/**
 * The types that MigQL knows. Their names are not case-sensitive: `VARCHAR(20)` and `varchar(20)` are the same type.
 * A type name that is not in this list is the exact name of a type of the schema, such as an enumeration.
 *
 * The same list is kept for people in `MIG-Ace-vault/migql/types.md`.
 */
export const TYPES: Record<string, string> = {
    bigint: 'a whole number of 64 bits',
    integer: 'a whole number of 32 bits',
    numeric: 'a number with a fixed precision and scale: numeric(12, 2)',
    varchar: 'a text up to a length: varchar(200)',
    char: 'a text of a fixed length: char(3)',
    text: 'a text of any length',
    boolean: 'true or false',
    date: 'a day',
    timestamp: 'a day and a time, without a time zone',
};

/** The name of the type in the list, if MigQL knows the type. */
export function knownType(written: string): string | undefined {
    const lower = written.toLowerCase();
    return lower in TYPES ? lower : undefined;
}
