import type { AstNode } from 'langium';
import { AstNodeHoverProvider } from 'langium/lsp';
import { generatePart, NotGeneratedYet } from '../../generators/postgresql/index.js';
import { isLetDefinition, isPart, type Part } from '../generated/ast.js';

/**
 * What the editor shows for the thing under the mouse.
 * The explanations of the keys are the comments in front of them in the grammar.
 */
export class MigqlHoverProvider extends AstNodeHoverProvider {

    protected getAstNodeHoverContent(node: AstNode): string | undefined {
        if (isLetDefinition(node)) {
            return code('migql', `${node.name}: ${node.condition.$cstNode?.text ?? ''}`);
        }
        if (isPart(node)) {
            return generated(node);
        }
        return undefined;
    }
}

/** The statement that will run for a part, so that the author sees what the database gets. */
function generated(part: Part): string | undefined {
    try {
        return code('sql', generatePart(part));
    } catch (error) {
        return error instanceof NotGeneratedYet ? error.message : undefined;
    }
}

function code(language: string, text: string): string {
    return '```' + language + '\n' + text + '\n```';
}
