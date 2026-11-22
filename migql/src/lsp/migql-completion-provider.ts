import { AstUtils, GrammarAST, type MaybePromise } from 'langium';
import { type CompletionAcceptor, type CompletionContext, DefaultCompletionProvider, type NextFeature } from 'langium/lsp';
import { CompletionItemKind, InsertTextFormat } from 'vscode-languageserver';
import { type Action, actionNamed } from '../actions/catalogue.js';
import { ACTION_DESCRIPTIONS } from '../actions/descriptions.js';
import { actionOf, parametersOf } from '../actions/parameters.js';
import { type ActionEntry, isActionEntry } from '../generated/ast.js';

/**
 * Completion that knows the catalogue of actions: the keys of a part come with a summary,
 * an action is inserted with its mandatory parameters, and inside an action the parameters
 * that are still missing are offered.
 */
export class MigqlCompletionProvider extends DefaultCompletionProvider {

    protected override completionFor(context: CompletionContext, next: NextFeature, acceptor: CompletionAcceptor): MaybePromise<void> {
        const action = isNameOfColumnValue(next.feature) ? actionAt(context) : undefined;
        if (action) {
            return this.completionForParameters(context, action, acceptor);
        }
        return super.completionFor(context, next, acceptor);
    }

    private completionForParameters(context: CompletionContext, entry: ActionEntry, acceptor: CompletionAcceptor): void {
        const action = actionOf(entry);
        const given = new Set(parametersOf(entry).map(parameter => parameter.column));
        action.parameters.filter(parameter => !given.has(parameter.name)).forEach((parameter, index) => acceptor(context, {
            label: parameter.name,
            kind: CompletionItemKind.Property,
            detail: ACTION_DESCRIPTIONS[action.name].parameters[parameter.name],
            insertText: `${parameter.name}: `,
            // Mandatory parameters first, each group in the order of the catalogue.
            sortText: `${parameter.mandatory ? 0 : 1}${String(index).padStart(2, '0')}`,
        }));
    }

    protected override completionForKeyword(context: CompletionContext, keyword: GrammarAST.Keyword, acceptor: CompletionAcceptor): MaybePromise<void> {
        const action = actionNamed(keyword.value.slice(0, -1));
        if (action) {
            if (this.filterKeyword(context, keyword)) {
                acceptor(context, {
                    label: keyword.value,
                    kind: CompletionItemKind.Function,
                    detail: ACTION_DESCRIPTIONS[action.name].summary,
                    documentation: { kind: 'markdown', value: ACTION_DESCRIPTIONS[action.name].description },
                    insertText: withPlacesToFillIn(action),
                    insertTextFormat: InsertTextFormat.Snippet,
                    sortText: `1${keyword.value}`,
                });
            }
            return;
        }
        const summary = summaryOf(keyword);
        if (!summary) {
            return super.completionForKeyword(context, keyword, acceptor);
        }
        if (this.filterKeyword(context, keyword)) {
            acceptor(context, { label: keyword.value, kind: this.getKeywordCompletionItemKind(keyword), detail: summary, sortText: `0${keyword.value}` });
        }
    }

    /** A statement that became an action is still read, to explain itself. It is not offered. */
    protected override filterKeyword(context: CompletionContext, keyword: GrammarAST.Keyword): boolean {
        const rule = AstUtils.getContainerOfType(keyword, GrammarAST.isParserRule);
        return rule?.name !== 'RemovedStatement' && super.filterKeyword(context, keyword);
    }
}

/** `column-rename: { table: ${1:table}, from: ${2:from}, to: ${3:to} }` */
function withPlacesToFillIn(action: Action): string {
    const places = action.parameters.filter(parameter => parameter.mandatory)
        .map((parameter, index) => `${parameter.name}: \${${index + 1}:${parameter.name}}`);
    return `${action.name}: { ${places.join(', ')} }`;
}

/** The first sentence of the comment that stands in front of a key in the grammar. */
function summaryOf(keyword: GrammarAST.Keyword): string | undefined {
    const comment = (keyword as { $comment?: string }).$comment;
    const text = comment?.replace(/^\/\*\*\s*|\s*\*\/$/g, '').replace(/\s*\n\s*\*\s?/g, ' ').trim();
    return text ? /^.*?[.](?=\s|$)/.exec(text)?.[0] ?? text : undefined;
}

/** Says whether the next thing to write is the name in `name: value`. */
function isNameOfColumnValue(feature: GrammarAST.AbstractElement): boolean {
    const assignment = AstUtils.getContainerOfType(feature, GrammarAST.isAssignment);
    const rule = AstUtils.getContainerOfType(feature, GrammarAST.isParserRule);
    return assignment?.feature === 'column' && (rule?.name === 'ColumnValue' || rule?.name === 'FlowValue');
}

/** The action in which the cursor stands. */
function actionAt(context: CompletionContext): ActionEntry | undefined {
    return AstUtils.getContainerOfType(context.node, isActionEntry);
}
