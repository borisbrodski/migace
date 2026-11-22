import type { IToken } from 'chevrotain';
import { parseDocument } from 'yaml';

/** What a YAML parser and the MigQL lexer can both say about a file: keys, lists and the text of values. */
export type Structure = string | Structure[] | { [key: string]: Structure };

/** The structure as a reference YAML parser sees it. Throws when the file is not valid YAML. */
export function yamlStructure(text: string): Structure {
    const document = parseDocument(text);
    if (document.errors.length > 0) {
        throw new Error(`Not valid YAML: ${document.errors.map(error => error.message).join('; ')}`);
    }
    return fromYaml(document.toJS());
}

function fromYaml(value: unknown): Structure {
    if (Array.isArray(value)) {
        return value.map(fromYaml);
    }
    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, fromYaml(item)]));
    }
    return scalar(String(value));
}

/**
 * White space and comments inside a statement mean nothing, and the two parsers keep different
 * amounts of them. Both sides are compared without.
 */
function scalar(text: string): string {
    return text.replace(/--.*$/gm, '').replace(/\s+/g, '');
}

/** The structure as the MigQL lexer sees it, rebuilt from its tokens. */
export function migqlStructure(tokens: IToken[]): Structure {
    return new TokenReader(tokens).block();
}

class TokenReader {

    private index = 0;

    constructor(private readonly tokens: IToken[]) { }

    block(): Structure {
        if (this.is('DASH')) {
            const items: Structure[] = [];
            while (this.is('DASH')) {
                this.index++;
                items.push(this.is('{') ? this.value() : this.entries());
            }
            return items;
        }
        return this.entries();
    }

    private entries(): Structure {
        const map: Record<string, Structure> = {};
        while (this.index < this.tokens.length && !this.is('DASH') && !this.is('DEDENT')) {
            const key = unquoted(this.next().image.replace(/:$/, ''));
            if (this.is(':')) {
                this.index++;
            }
            if (this.is('INDENT')) {
                this.index++;
                map[key] = this.block();
                this.index++;
            } else if (this.is('DASH') || this.is('DEDENT') || this.index >= this.tokens.length) {
                map[key] = 'null';
            } else {
                map[key] = this.value();
            }
        }
        return map;
    }

    /** The tokens up to the end of the value: one text, or a flow map. */
    private value(): Structure {
        const tokens: IToken[] = [];
        while (!this.is('EOL')) {
            tokens.push(this.next());
        }
        this.index++;
        switch (tokens[0]?.image) {
            case '{': return flowMap(tokens.slice(1, -1));
            case '[': return flowList(tokens.slice(1, -1));
            default: return text(tokens);
        }
    }

    private is(name: string): boolean {
        return this.tokens[this.index]?.tokenType.name === name;
    }

    private next(): IToken {
        return this.tokens[this.index++];
    }
}

function flowMap(tokens: IToken[]): Structure {
    const map: Record<string, Structure> = {};
    let start = 0;
    for (let index = 0; index <= tokens.length; index++) {
        if (index === tokens.length || tokens[index].image === ',') {
            if (index > start) {
                map[unquoted(tokens[start].image)] = text(tokens.slice(start + 2, index));
            }
            start = index + 1;
        }
    }
    return map;
}

function flowList(tokens: IToken[]): Structure {
    return tokens.filter(token => token.image !== ',').map(token => text([token]));
}

/** A name in double quotes is the name without them, for YAML as for MigQL. */
function unquoted(image: string): string {
    return /^"[^"]*"$/.test(image) ? image.slice(1, -1) : image;
}

function text(tokens: IToken[]): string {
    if (tokens.length === 0) {
        return 'null';
    }
    if (tokens.length === 1 && tokens[0].tokenType.name === 'QUOTED_ID') {
        return scalar(unquoted(tokens[0].image));
    }
    if (tokens.length === 1 && tokens[0].tokenType.name === 'STRING') {
        return scalar(tokens[0].image.slice(1, -1).replace(/''/g, "'"));
    }
    return scalar(tokens.map(token => token.image).join(' '));
}
