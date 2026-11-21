import type { NameEntry, Part, Snippet } from '../generated/ast.js';
import { isNameEntry, isPartsEntry } from '../generated/ast.js';

/** The entry that names the snippet: `migration:` or `repair:`. */
export function nameEntry(snippet: Snippet): NameEntry | undefined {
    return snippet.entries.find(isNameEntry);
}

/** The parts of a snippet in the order in which they run. */
export function partsOf(snippet: Snippet): Part[] {
    return snippet.entries.filter(isPartsEntry).flatMap(entry => entry.parts);
}

/** The name of a snippet without its date and time. Other snippets refer to it by this name. */
export function slugOf(snippet: Snippet): string | undefined {
    return nameEntry(snippet)?.name.replace(/^\d{8}-\d{4}-/, '');
}
