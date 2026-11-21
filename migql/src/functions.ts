/**
 * The functions a snippet may call, with what they do. Every supported database has all of them,
 * under this name or under another one that the generator knows.
 *
 * The same list is kept for people in `MIG-Ace-vault/migql/functions.md`.
 */
export const FUNCTIONS: Record<string, string> = {
    upper: 'upper(text): the text in upper case.',
    lower: 'lower(text): the text in lower case.',
    trim: 'trim(text): the text without spaces at its start and its end.',
    substring: 'substring(text, start, length): a piece of the text. The first character has the position 1.',
    length: 'length(text): the number of characters.',
    coalesce: 'coalesce(value, …): the first value that is not null.',
    days: 'days(number): a number of days, to add to a date or to subtract from it.',
    count: 'count(*): the number of rows of a subquery.',
    max: 'max(value): the largest value of a subquery.',
    min: 'min(value): the smallest value of a subquery.',
    sum: 'sum(value): the sum of the values of a subquery.',
};
