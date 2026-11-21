import { type AstNodeDescription, DefaultScopeComputation, type LangiumDocument } from 'langium';
import type { Snippet } from '../generated/ast.js';
import { partsOf, slugOf } from '../model/snippet.js';

/**
 * Makes the parts of a snippet known to other snippets as `<slug>.<part>`.
 * The slug is the name without date and time, so the name survives a move of the snippet.
 */
export class MigqlScopeComputation extends DefaultScopeComputation {

    override async collectExportedSymbols(document: LangiumDocument): Promise<AstNodeDescription[]> {
        const snippet = document.parseResult.value as Snippet;
        const slug = slugOf(snippet);
        if (!slug) {
            return [];
        }
        return partsOf(snippet).map(part => this.descriptions.createDescription(part, `${slug}.${part.name}`, document));
    }
}
