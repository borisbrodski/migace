import type { IParserErrorMessageProvider, IToken, TokenType } from 'chevrotain';
import { AstUtils, GrammarAST, type LangiumCoreServices } from 'langium';

type Paths = TokenType[][];

/** What a token of the envelope or a terminal of the statement language is called in a message. */
const LABELS: Record<string, string> = {
    EOL: 'the end of the value',
    INDENT: 'an indented block',
    DEDENT: 'the end of the block',
    DASH: 'a list item that starts with "- "',
    NAME: 'a name',
    WORD: 'a name',
    TEXT: 'a text',
    ID: 'a name',
    QUOTED_ID: 'a name',
    INT: 'a number',
    DECIMAL: 'a number',
    STRING: 'a text in single quotes',
    PART_REF: 'a part, written as snippet.part',
    RELEASE: 'the name of a release',
};


/**
 * Says in the words of an author what the parser expected.
 * Chevrotain lists token sequences, which helps the author of the grammar but not the author of a snippet.
 */
export class MigqlParserErrorMessageProvider implements IParserErrorMessageProvider {

    /** Keywords that the grammar also accepts as names. Where a name fits, they need no mention. */
    private readonly nameKeywords: Set<string>;

    constructor(services: LangiumCoreServices) {
        const nameRule = services.Grammar.rules.find(rule => rule.name === 'Name')!;
        this.nameKeywords = new Set(AstUtils.streamAllContents(nameRule).filter(GrammarAST.isKeyword).map(keyword => keyword.value));
    }

    buildMismatchTokenMessage(options: { expected: TokenType, actual: IToken }): string {
        return message([options.expected], options.actual, this.nameKeywords);
    }

    buildNotAllInputParsedMessage(options: { firstRedundant: IToken }): string {
        return message([], options.firstRedundant, this.nameKeywords);
    }

    buildNoViableAltMessage(options: { expectedPathsPerAlt: Paths[], actual: IToken[] }): string {
        return message(firstTokens(options.expectedPathsPerAlt.flat()), options.actual[0], this.nameKeywords);
    }

    buildEarlyExitMessage(options: { expectedIterationPaths: Paths, actual: IToken[] }): string {
        return message(firstTokens(options.expectedIterationPaths), options.actual[0], this.nameKeywords);
    }
}

function firstTokens(paths: Paths): TokenType[] {
    return paths.filter(path => path.length > 0).map(path => path[0]);
}

function message(expected: TokenType[], actual: IToken, nameKeywords: Set<string>): string {
    const names = [...new Set(expected.map(token => token.name))];
    if (names.length === 0 || names.every(name => name === 'EOL')) {
        return `Unexpected ${found(actual)}. The value is complete before it.`;
    }
    return `Expected ${describe(names, nameKeywords)}, but ${actual.image.length > 0 ? `found ${found(actual)}` : ending(actual)}.` +
        (names.includes('ID') && isKeyword(actual) ? quoteAdvice(actual.image) : '');
}

/** A keyword of the statement language is a token whose name is its own text, made of letters. */
function isKeyword(token: IToken): boolean {
    return /^[A-Za-z]+$/.test(token.image) && token.tokenType.name.toLowerCase() === token.image.toLowerCase();
}

function quoteAdvice(keyword: string): string {
    return ` "${keyword}" is a keyword. To use it as a name, write it in double quotes: "${keyword}".`;
}

/** Statements that became actions are still read, to explain themselves. Nobody should be told to write them. */
const REMOVED_STATEMENTS = ['ensure', 'rename'];

function describe(allNames: string[], nameKeywords: Set<string>): string {
    const names = allNames.includes('ensure') ? allNames.filter(name => !REMOVED_STATEMENTS.includes(name)) : allNames;
    if (names.includes('STRING') && names.includes('INT')) {
        return 'a value';
    }
    const relevant = names.includes('ID') ? names.filter(name => !nameKeywords.has(name)) : names;
    const labels = [...new Set(relevant.map(label))];
    return labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(', ')} or ${labels[labels.length - 1]}`;
}

function label(name: string): string {
    return LABELS[name] ?? `"${withoutColon(name)}"`;
}

function found(actual: IToken): string {
    return `"${withoutColon(actual.image)}"`;
}

/** A key of the envelope is one token together with its colon. The author thinks of the key alone. */
function withoutColon(text: string): string {
    return text.length > 1 && text.endsWith(':') ? text.slice(0, -1) : text;
}

/** A token without text marks an end: of a value, of a block or of the file. */
function ending(actual: IToken): string {
    switch (actual.tokenType.name) {
        case 'EOL': return 'the value ends here';
        case 'INDENT': return 'an indented block starts here';
        case 'DEDENT': return 'the block ends here';
        default: return 'the file ends here';
    }
}
