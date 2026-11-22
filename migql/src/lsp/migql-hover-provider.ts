import { type AstNode, CstUtils, type LangiumDocument } from 'langium';
import { AstNodeHoverProvider } from 'langium/lsp';
import type { Hover, HoverParams } from 'vscode-languageserver';
import { generatePart, NotGeneratedYet } from '../../generators/postgresql/index.js';
import { ACTION_DESCRIPTIONS } from '../actions/descriptions.js';
import { actionName } from '../actions/parameters.js';
import { type ActionEntry, isActionEntry, isColumnValue, isFlowMap, isLetDefinition, isPart, type Part } from '../generated/ast.js';

/**
 * What the editor shows for the thing under the mouse.
 * The explanations of the keys are the comments in front of them in the grammar.
 * The descriptions of the actions and their parameters come from the catalogue of constructs.
 */
export class MigqlHoverProvider extends AstNodeHoverProvider {

    override async getHoverContent(document: LangiumDocument, params: HoverParams): Promise<Hover | undefined> {
        const text = this.actionHover(document, params);
        return text ? { contents: { kind: 'markdown', value: text } } : super.getHoverContent(document, params);
    }

    private actionHover(document: LangiumDocument, params: HoverParams): string | undefined {
        const root = document.parseResult.value.$cstNode;
        const leaf = root ? CstUtils.findLeafNodeAtOffset(root, document.textDocument.offsetAt(params.position)) : undefined;
        const node = leaf?.astNode;
        if (isActionEntry(node) && leaf?.text === node.action) {
            const name = actionName(node);
            return `**${name}**\n\n${ACTION_DESCRIPTIONS[name].description}`;
        }
        const action = isColumnValue(node) ? actionOfParameter(node.$container) : undefined;
        if (isColumnValue(node) && action && leaf && leaf.offset === node.$cstNode?.offset) {
            const description = ACTION_DESCRIPTIONS[actionName(action)].parameters[node.column];
            return description ? `**${node.column}** of ${actionName(action)}\n\n${description}` : undefined;
        }
        return undefined;
    }

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

function actionOfParameter(holder: AstNode | undefined): ActionEntry | undefined {
    const entry = isFlowMap(holder) ? holder.$container : holder;
    return isActionEntry(entry) ? entry : undefined;
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
