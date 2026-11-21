import { DefaultLinker, type AstNodeDescription, type IndexManager, type LangiumCoreServices, type LangiumDocument, type LinkingError, type ReferenceInfo } from 'langium';
import { isNameRef, isRanCondition } from '../generated/ast.js';
import { isConditionName, letDefinitions } from './names.js';

export class MigqlLinker extends DefaultLinker {

    private readonly indexManager: IndexManager;

    constructor(services: LangiumCoreServices) {
        super(services);
        this.indexManager = services.shared.workspace.IndexManager;
    }

    /** A name of a column is not looked up: the schema is not known here. */
    override doLink(refInfo: ReferenceInfo, document: LangiumDocument): void {
        if (isNameRef(refInfo.container) && !isConditionName(refInfo.container)) {
            return;
        }
        super.doLink(refInfo, document);
    }

    protected override createLinkingError(refInfo: ReferenceInfo, targetDescription?: AstNodeDescription): LinkingError {
        const error = super.createLinkingError(refInfo, targetDescription);
        if (isNameRef(refInfo.container)) {
            const defined = letDefinitions(refInfo.container).map(definition => definition.name);
            error.message = `Unknown condition "${refInfo.reference.$refText}". Define it under "let", or check the spelling.` +
                (defined.length > 0 ? ` Defined here: ${defined.join(', ')}.` : '');
        }
        if (isRanCondition(refInfo.container)) {
            error.message = this.unknownPart(refInfo.reference.$refText);
        }
        return error;
    }

    private unknownPart(reference: string): string {
        const [slug, part] = reference.split('.');
        const parts = this.indexManager.allElements('Part')
            .filter(description => description.name.startsWith(slug + '.'))
            .map(description => description.name.substring(slug.length + 1))
            .toArray();
        return parts.length > 0
            ? `The snippet "${slug}" has no part "${part}". Its parts: ${parts.join(', ')}.`
            : `No snippet is named "${slug}". Name the snippet without its date and time, then the part: <snippet>.<part>.`;
    }
}
