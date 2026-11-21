import { type CstNode, DefaultValueConverter, type GrammarAST, type ValueType } from 'langium';

export class MigqlValueConverter extends DefaultValueConverter {

    protected override runConverter(rule: GrammarAST.AbstractRule, input: string, cstNode: CstNode): ValueType {
        switch (rule.name) {
            case 'STRING': return input.slice(1, -1).replace(/''/g, "'");
            case 'TEXT': return isLiteralBlock(cstNode) ? blockText(input, cstNode.range.start.character) : input;
            default: return super.runConverter(rule, input, cstNode);
        }
    }
}

/** The text of a literal block starts on a line below its key. */
function isLiteralBlock(text: CstNode): boolean {
    return text.range.start.line > text.container!.range.start.line;
}

/**
 * The value of a literal block as YAML defines it: every line without the indentation of the
 * first line, and one line break at the end.
 */
function blockText(input: string, indentation: number): string {
    const [first, ...rest] = input.split(/\r?\n/);
    const unindent = (line: string) => line.substring(Math.min(indentation, line.length - line.trimStart().length));
    return [first, ...rest.map(unindent)].join('\n') + '\n';
}
