import type { CustomPatternMatcherFunc, IToken, TokenType, TokenVocabulary } from 'chevrotain';
import { DefaultTokenBuilder, type Grammar, type TokenBuilderOptions } from 'langium';

/**
 * Two tokens of the statement language are read only in one place:
 * the reference to a part after `ran`, and the name of a release after `ran … from`.
 * Both contain characters that mean something else everywhere else: `order-status` is a
 * subtraction, `1.2.0` is a number followed by more. So the place decides.
 */
export class MigqlTokenBuilder extends DefaultTokenBuilder {

    override buildTokens(grammar: Grammar, options?: TokenBuilderOptions): TokenVocabulary {
        const tokens = super.buildTokens(grammar, options) as TokenType[];
        const placed = [
            onlyAfter(named(tokens, 'PART_REF'), ['ran']),
            onlyAfter(named(tokens, 'RELEASE'), ['PART_REF', 'from']),
        ];
        return [...placed, ...tokens.filter(token => !placed.includes(token))];
    }
}

const FIRST_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function named(tokens: TokenType[], name: string): TokenType {
    return tokens.find(token => token.name === name)!;
}

/** Makes the token match only when the tokens before it are the given ones. */
function onlyAfter(token: TokenType, before: string[]): TokenType {
    const pattern = new RegExp((token.PATTERN as RegExp).source, 'y');
    const match: CustomPatternMatcherFunc = (text, offset, matched) => {
        if (!endsWith(matched, before)) {
            return null;
        }
        pattern.lastIndex = offset;
        return pattern.exec(text);
    };
    token.PATTERN = match;
    token.LINE_BREAKS = false;
    // Without this hint Chevrotain tries every token at every position instead of only those that can start there.
    token.START_CHARS_HINT = [...FIRST_CHARACTERS];
    return token;
}

function endsWith(tokens: IToken[], names: string[]): boolean {
    return names.every((name, index) => tokens[tokens.length - names.length + index]?.tokenType.name === name);
}
