import { createHash } from 'node:crypto';
import type { IToken } from 'chevrotain';

/**
 * The checksum of a part. The ledger and the release files store it, to know which version of a part ran.
 *
 * A checksum names the version of its rule: `v1:9f3e…`. A rule never changes. Another rule gets another
 * number, and every earlier rule stays in this file, so that a checksum written years ago can still be compared.
 *
 * No rule uses the syntax tree or the generated SQL: a newer parser or a better generator must not change
 * the checksum of a part that nobody edited. The rules work on the tokens of the lexer.
 */
export type Checksum = string;

/** The checksums of all parts of a snippet, by the name of the part, in the order of the file. */
export function partChecksums(tokens: IToken[]): Map<string, Checksum> {
    return new Map([...partTokens(tokens)].map(([name, body]) => [name, checksumV1(body)]));
}

/**
 * Rule v1: the tokens of the part as the author wrote it. White space and comments are no tokens and do not
 * count. The case of a keyword does not count. Everything else counts, also the choice between two spellings
 * of the same thing. Free text and native SQL count as written, without the indentation of their block and
 * without white space at the ends of their lines.
 */
export function checksumV1(body: IToken[]): Checksum {
    const hash = createHash('sha256');
    for (const token of body) {
        hash.update(`${token.tokenType.name}\u0000${textV1(token)}\u0001`);
    }
    return `v1:${hash.digest('hex')}`;
}

function textV1(token: IToken): string {
    const type = token.tokenType.name;
    if (type === 'TEXT') {
        const indentation = (token.startColumn ?? 1) - 1;
        const [first, ...rest] = token.image.split(/\r?\n/);
        const unindented = rest.map(line => line.substring(Math.min(indentation, line.length - line.trimStart().length)));
        return [first, ...unindented].map(line => line.trimEnd()).join('\n');
    }
    // A terminal keeps its text. Every other token is a keyword or a sign, known by its type whatever its case.
    return /^[A-Z_]+$/.test(type) ? token.image : type;
}

/**
 * The tokens of every part, without the name of the part: what stands between `- name:` and the next part.
 * The parts are found in the token stream, where the list below `parts:` is one level of indentation deep.
 */
function partTokens(tokens: IToken[]): Map<string, IToken[]> {
    const parts = new Map<string, IToken[]>();
    const start = tokens.findIndex(token => token.tokenType.name === 'parts:');
    let depth = 0;
    let current: IToken[] | undefined;
    for (let index = start + 1; start >= 0 && index < tokens.length; index++) {
        const type = tokens[index].tokenType.name;
        depth += type === 'INDENT' ? 1 : type === 'DEDENT' ? -1 : 0;
        if (depth === 0) {
            break;
        }
        if (type === 'DASH' && depth === 1) {
            current = [];
            parts.set(tokens[index + 1]?.image ?? '', current);
            // The name and its colon are the identity of the part, not its content.
            index += 2;
        } else if (!(type === 'INDENT' && depth === 1)) {
            current?.push(tokens[index]);
        }
    }
    return parts;
}
