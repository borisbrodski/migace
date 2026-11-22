/**
 * A name in MigQL is exact: the database gets the characters and the case that the snippet has.
 * Double quotes do not change the meaning. They only allow a name that is a keyword or that
 * contains other characters than letters, digits and underscores.
 */

/** The name that a written name stands for: the text without the double quotes around it. */
export function exactName(written: string): string {
    return written.startsWith('"') && written.endsWith('"') && written.length >= 2 ? written.slice(1, -1) : written;
}

/** Says whether two written names are the same name. Every comparison of names goes through this function. */
export function sameName(a: string, b: string): boolean {
    return exactName(a) === exactName(b);
}
