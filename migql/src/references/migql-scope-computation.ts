import { type AstNodeDescription, DefaultScopeComputation, type LangiumDocument } from 'langium';
import type { Snippet } from '../generated/ast.js';
import { isUidEntry } from '../generated/ast.js';
import { nameEntry, partsOf, slugOf } from '../model/snippet.js';

/**
 * Makes a snippet known to the other snippets of a project:
 *
 * - its parts as `<slug>.<part>`, for `ran`. The slug is the name without date and time,
 *   so a reference survives a move of the snippet.
 * - its slug and its uid, so that a second snippet with the same one is found.
 */
export class MigqlScopeComputation extends DefaultScopeComputation {

    override async collectExportedSymbols(document: LangiumDocument): Promise<AstNodeDescription[]> {
        const snippet = document.parseResult.value as Snippet;
        const name = nameEntry(snippet);
        const slug = slugOf(snippet);
        const uids = snippet.entries.filter(isUidEntry);
        return [
            ...(name && slug ? [this.descriptions.createDescription(name, slug, document)] : []),
            ...uids.map(uid => this.descriptions.createDescription(uid, uid.value, document)),
            ...(slug ? partsOf(snippet).map(part => this.descriptions.createDescription(part, `${slug}.${part.name}`, document)) : []),
        ];
    }
}
