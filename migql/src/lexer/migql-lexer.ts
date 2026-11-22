import type { ILexingError, IToken, TokenType, TokenTypeDictionary } from 'chevrotain';
import { Lexer as ChevrotainLexer, createTokenInstance } from 'chevrotain';
import type { LangiumCoreServices, Lexer, LexerResult, TokenizeOptions } from 'langium';
import { type Context, type ValueKind, snippetContext } from './envelope-schema.js';

/** Terminals of the envelope. This lexer creates them itself; the statement lexer never sees them. */
const ENVELOPE_TERMINALS = new Set(['INDENT', 'DEDENT', 'EOL', 'DASH', 'NAME', 'WORD', 'TEXT']);

/**
 * Reads the YAML envelope of a snippet line by line.
 *
 * The envelope decides how a value is read: the tokens after `do:` belong to the statement
 * language, the text after `doc:` is free text. A general-purpose lexer cannot know that,
 * so this one follows the keys.
 */
export class MigqlLexer implements Lexer {

    readonly definition: TokenTypeDictionary;
    private readonly statementLexer: ChevrotainLexer;

    constructor(services: LangiumCoreServices) {
        const tokens = services.parser.TokenBuilder.buildTokens(services.Grammar, {
            caseInsensitive: services.LanguageMetaData.caseInsensitive,
        }) as TokenType[];
        this.definition = Object.fromEntries(tokens.map(token => [token.name, token]));
        this.statementLexer = new ChevrotainLexer(tokens.filter(isStatementToken), {
            positionTracking: 'full',
            skipValidations: services.LanguageMetaData.mode === 'production',
        });
    }

    /**
     * In the mode `partial` the text ends at the cursor of the editor. What is still being typed
     * there stays open: no end of the value and no end of the blocks is added.
     */
    tokenize(text: string, options?: TokenizeOptions): LexerResult {
        return new Scan(text, this.definition, this.statementLexer, options?.mode === 'partial').run();
    }
}

function isStatementToken(token: TokenType): boolean {
    const isEnvelopeKey = token.name.length > 1 && token.name.endsWith(':');
    return !isEnvelopeKey && !ENVELOPE_TERMINALS.has(token.name);
}

/** YAML starts a comment at a `#` that stands at the start of a value or after white space. */
function withoutComment(value: string): string {
    const comment = /(^|\s)#/.exec(value);
    return comment ? value.substring(0, comment.index) : value;
}

type Problem = [message: string, length: number];

/** Says why a line that should be `key: value` is none. */
function notAnEntry(rest: string): Problem {
    if (/^(---|\.\.\.)(\s|$)/.test(rest)) {
        return ['Several documents in one file are not part of MigQL. Write one snippet per file.', 3];
    }
    const quotedKey = /^(["'])(?:(?!\1).)*\1(?=[ ]*:)/.exec(rest);
    if (quotedKey) {
        return ['Quoted keys are not part of MigQL. Write the key without quotes.', quotedKey[0].length];
    }
    return ['Expected a key followed by a colon.', rest.trimEnd().length];
}

/** Recognises the YAML constructs at the start of a value that MigQL leaves out. */
function unsupportedValue(value: string): Problem | undefined {
    const word = /^\S*/.exec(value)![0];
    switch (value.charAt(0)) {
        case '&': return ['Anchors (&name) are not part of MigQL. Write the value out.', word.length];
        case '*': return ['Aliases (*name) are not part of MigQL. Repeat the value.', word.length];
        case '!': return ['Tags (!name) are not part of MigQL. Remove the tag.', word.length];
        case '>': return /^>[-+\d]*$/.test(value)
            ? ['Folded blocks (>) are not part of MigQL. Use a literal block (|).', 1]
            : undefined;
        default: return undefined;
    }
}

/** The end of every message about a one-line value that YAML reads differently. A quick fix follows it. */
export const LITERAL_BLOCK_ADVICE = ' Use a literal block: write | after the key and the value on the lines below it.';

/**
 * Finds the place in a one-line value where a YAML parser reads something else than MigQL does.
 * `rest` is the line after the key, `value` the same without a comment at its end.
 */
function misreadByYaml(rest: string, value: string, kind: ValueKind | undefined): { message: string, at: number } | undefined {
    const first = value.charAt(0);
    if (kind === 'text' && (first === "'" || first === '"')) {
        return { message: 'Free text is not put in quotes. Remove the quotes, or use a literal block: write | after the key and the text on the lines below it.', at: 0 };
    }
    const isOneQuotedText = /^'(?:[^']|'')*'$/.test(value);
    const isOneQuotedName = /^"[^"]*"$/.test(value);
    const isList = first === '[' && value.endsWith(']');
    if (first !== '' && '\'"@`%[]},'.includes(first) && !isOneQuotedText && !isOneQuotedName && !isList) {
        return { message: `YAML reads a value that starts with ${first} differently.${LITERAL_BLOCK_ADVICE}`, at: 0 };
    }
    const comment = /\s#/.exec(rest);
    const quotes = value.split("'").length - 1;
    if (comment && quotes % 2 === 1) {
        return { message: `YAML reads " #" as the start of a comment, so the rest of the line would be lost.${LITERAL_BLOCK_ADVICE}`, at: comment.index + 1 };
    }
    const colon = first === '{' ? null : /:(\s|$)/.exec(value);
    if (colon) {
        return { message: `YAML does not allow ": " inside a value that stands on the line of its key.${LITERAL_BLOCK_ADVICE}`, at: colon.index };
    }
    return undefined;
}

/** Says what a name in double quotes has that MigQL does not support. */
function unsupportedName(image: string): string | undefined {
    if (image === '""') {
        return 'A name cannot be empty. Write the name between the double quotes.';
    }
    return image.slice(1, -1).includes('"') ? 'A double quote inside a name is not supported. Choose a name without it.' : undefined;
}

/**
 * The items of a flow map, split at the commas that stand outside quotes and brackets.
 * `start` is the place of the item in the text; `separated` says that a comma stands before it.
 */
function flowItems(text: string): Array<{ text: string, start: number, separated: boolean }> {
    const items: Array<{ text: string, start: number, separated: boolean }> = [];
    let start = 0;
    let depth = 0;
    let quote = '';
    for (let index = 0; index <= text.length; index++) {
        const character = text.charAt(index);
        if (quote) {
            quote = character === quote ? '' : quote;
        } else if (character === "'" || character === '"') {
            quote = character;
        } else if ('([{'.includes(character) && character !== '') {
            depth++;
        } else if (')]}'.includes(character) && character !== '') {
            depth--;
        }
        if (index === text.length || (character === ',' && depth === 0 && !quote)) {
            if (text.substring(start, index).trim().length > 0 || index < text.length || start > 0) {
                items.push({ text: text.substring(start, index), start, separated: start > 0 });
            }
            start = index + 1;
        }
    }
    return items;
}

interface Level {
    indent: number;
    context: Context;
    /** The content of a list item. It closes without a DEDENT. */
    item: boolean;
}

/** A position in the text. Line and column start at 1, as Chevrotain counts them. */
interface Position {
    offset: number;
    line: number;
    column: number;
}

/** A piece of the text that may cover several lines. */
interface Span {
    start: Position;
    /** The offset after the last character. */
    end: number;
    /** The start of the line on which the piece ends. */
    endLine: Position;
}

/** One pass over one text. */
class Scan {

    private readonly tokens: IToken[] = [];
    private readonly hidden: IToken[] = [];
    private readonly errors: ILexingError[] = [];
    private readonly levels: Level[] = [{ indent: 0, context: snippetContext, item: false }];
    /** The context of a key that had no value on its line. Nested lines may follow. */
    private pending?: Context;
    /** Set after an entry that could not be read: deeper lines belong to it and are skipped. */
    private skipBelow?: number;
    /** Set after a list that stands at the indentation of its key: its items are skipped. */
    private skipListAt?: number;

    private nextOffset = 0;
    private lineOffset = 0;
    private lineNumber = 0;
    private line = '';

    constructor(
        private readonly text: string,
        private readonly definition: TokenTypeDictionary,
        private readonly statementLexer: ChevrotainLexer,
        private readonly partial: boolean,
    ) { }

    run(): LexerResult {
        while (this.nextLine()) {
            this.scanLine();
        }
        if (!this.partial) {
            this.closeLevels(0);
        } else if (this.line.trim().length === 0) {
            this.moveToIndentation(this.line.length);
        }
        return { tokens: this.tokens, hidden: this.hidden, errors: this.errors };
    }

    /** Moves to the next line. Returns false at the end of the text. */
    private nextLine(): boolean {
        if (this.nextOffset > this.text.length) {
            return false;
        }
        let end = this.text.indexOf('\n', this.nextOffset);
        if (end < 0) {
            end = this.text.length;
        }
        this.lineOffset = this.nextOffset;
        this.lineNumber++;
        this.line = this.text.substring(this.lineOffset, end).replace(/\r$/, '');
        this.nextOffset = end + 1;
        return true;
    }

    private scanLine(): void {
        if (/^\s*(#.*)?$/.test(this.line)) {
            return;
        }
        const indentation = /^[ \t]*/.exec(this.line)![0];
        const tab = indentation.indexOf('\t');
        if (tab >= 0) {
            this.error('Tab in the indentation. Indent with spaces only.', tab, 1);
            return;
        }
        const indent = indentation.length;
        if (this.skipBelow !== undefined) {
            if (indent > this.skipBelow) {
                return;
            }
            this.skipBelow = undefined;
        }
        if (this.pending && indent === this.top.indent && /^-(\s|$)/.test(this.line.substring(indent))) {
            this.error('A list is indented below its key. Indent this line and the other lines of the list.', indent, 1);
            this.pending = undefined;
            this.skipListAt = indent;
        }
        if (this.skipListAt !== undefined) {
            if (indent > this.skipListAt || (indent === this.skipListAt && this.line.charAt(indent) === '-')) {
                return;
            }
            this.skipListAt = undefined;
        }
        this.moveToIndentation(indent);
        if (indent > this.top.indent) {
            this.error('A value over several lines needs a literal block: put | after the key and indent the lines below it.',
                indent, this.line.trimEnd().length - indent);
            return;
        }
        this.scanEntry(indent);
    }

    /** Opens the block that a key without value announced, or closes the blocks that end before this indentation. */
    private moveToIndentation(indent: number): void {
        if (this.pending && indent > this.top.indent) {
            this.levels.push({ indent, context: this.pending, item: false });
            this.emit('INDENT', '', indent);
        }
        this.pending = undefined;
        this.closeLevels(indent);
    }

    private closeLevels(indent: number): void {
        while (this.levels.length > 1 && indent < this.top.indent) {
            const level = this.levels.pop()!;
            if (!level.item) {
                this.emit('DEDENT', '', indent);
            }
        }
    }

    private scanEntry(column: number): void {
        const rest = this.line.substring(column);
        const dash = /^-[ ]+/.exec(rest);
        if (dash) {
            this.emit('DASH', '-', column);
            const itemColumn = column + dash[0].length;
            this.levels.push({ indent: itemColumn, context: this.top.context, item: true });
            if (this.top.context.flowItems) {
                this.scanFlowItem(itemColumn);
            } else {
                this.scanEntry(itemColumn);
            }
            return;
        }
        const entry = /^([A-Za-z_][\w-]*):(?:[ ]+|$)/.exec(rest)
            ?? (this.top.context.quotedNames ? /^("[^"\r\n]*"):(?:[ ]+|$)/.exec(rest) : null);
        if (!entry) {
            if (/^[A-Za-z_][\w-]*$/.test(rest.trimEnd())) {
                // A key that is still being typed. The parser says which keys fit here.
                this.emit('NAME', rest.trimEnd(), column);
                this.skipBelow = column;
            } else {
                this.rejectEntry(column, ...notAnEntry(rest));
            }
            return;
        }
        const key = entry[1];
        const context = this.top.context;
        const fixed = context.keys?.[key];
        const spec = fixed ?? context.names;
        if (!spec) {
            const allowed = Object.keys(context.keys ?? {}).join(', ');
            this.rejectEntry(column, `Unknown key "${key}". Allowed here: ${allowed}.`, key.length);
            return;
        }
        const valueColumn = column + entry[0].length;
        const afterKey = this.line.substring(valueColumn);
        const value = withoutComment(afterKey).trimEnd();
        const unsupported = unsupportedValue(value);
        if (unsupported) {
            this.rejectEntry(column, ...unsupported, valueColumn);
            return;
        }
        const misread = misreadByYaml(afterKey, value, spec.value);
        if (misread) {
            this.rejectEntry(column, misread.message, 1, valueColumn + misread.at);
            return;
        }
        if (fixed) {
            this.emit(`${key}:`, `${key}:`, column);
        } else {
            this.emit('NAME', key, column);
            this.emit(':', ':', column + key.length);
        }
        if (value.length === 0 && spec.children) {
            this.pending = spec.children;
            return;
        }
        const source = value === '|' ? this.readBlock(column) : this.span(valueColumn, value.length);
        if (source.end > source.start.offset) {
            this.scanValue(spec.value, source);
        }
        this.endValue(source);
    }

    private endValue(source: Span): void {
        const stillTyped = this.partial && this.nextOffset > this.text.length;
        if (!stillTyped) {
            this.emitAt('EOL', this.endOf(source), this.endOf(source));
        }
    }

    /**
     * Reads the lines of a literal block: all following lines that are indented deeper than the key.
     * The block starts at the first character of its first line and ends with its last line.
     */
    private readBlock(keyColumn: number): Span {
        let start: Position | undefined;
        let end = this.lineOffset + this.line.length;
        let endLine: Position = this.position(0);
        for (;;) {
            const checkpoint = { nextOffset: this.nextOffset, lineOffset: this.lineOffset, lineNumber: this.lineNumber, line: this.line };
            if (!this.nextLine()) {
                break;
            }
            const indent = this.line.length - this.line.trimStart().length;
            if (this.line.trim().length === 0) {
                continue;
            }
            if (indent <= keyColumn) {
                Object.assign(this, checkpoint);
                break;
            }
            start ??= this.position(indent);
            end = this.lineOffset + this.line.trimEnd().length;
            endLine = this.position(0);
        }
        start ??= { offset: end, line: endLine.line, column: end - endLine.offset + 1 };
        return { start, end, endLine };
    }

    /** A piece of the current line. */
    private span(column: number, length: number): Span {
        return { start: this.position(column), end: this.lineOffset + column + length, endLine: this.position(0) };
    }

    private endOf(span: Span): Position {
        return { offset: span.end, line: span.endLine.line, column: span.end - span.endLine.offset + 1 };
    }

    private scanValue(kind: ValueKind | undefined, source: Span): void {
        if (kind === 'word') {
            this.emitAt('WORD', source.start, this.endOf(source));
        } else if (kind === 'text') {
            this.emitAt('TEXT', source.start, this.endOf(source));
        } else {
            this.scanStatement(source);
        }
    }

    /** A list item that is a value and has no key. */
    private scanFlowItem(column: number): void {
        const value = withoutComment(this.line.substring(column)).trimEnd();
        const source = this.span(column, value.length);
        this.scanStatement(source);
        this.endValue(source);
    }

    /** Reports an entry that cannot be read. The entry and the lines nested below it produce no tokens. */
    private rejectEntry(entryColumn: number, message: string, length: number, errorColumn = entryColumn): void {
        this.error(message, errorColumn, length);
        this.skipBelow = entryColumn;
    }

    /** Reads a value in the statement language. A value in `{ … }` is a flow map with keys of its own. */
    private scanStatement(source: Span): void {
        const text = this.text.substring(source.start.offset, source.end);
        if (text.startsWith('{') && !text.includes('\n')) {
            this.scanFlowMap(text, source.start.column - 1);
        } else {
            this.lexStatement(source);
        }
    }

    /**
     * Reads `{ key: value, … }` on the current line. A key is a name, whatever word it is:
     * `table`, `from` and `not-null` are keys here and no keywords. The values are read by the statement lexer.
     */
    private scanFlowMap(text: string, column: number): void {
        const closed = text.endsWith('}') && text.length > 1;
        this.emit('{', '{', column);
        for (const item of flowItems(closed ? text.slice(1, -1) : text.slice(1))) {
            const start = column + 1 + item.start;
            if (item.separated) {
                this.emit(',', ',', start - 1);
            }
            if (item.text.trim().length === 0) {
                continue;
            }
            const key = /^(\s*)("[^"]*"|[A-Za-z_][\w-]*)(\s*):(?=\s|$)/.exec(item.text);
            if (!key) {
                this.lexStatement(this.span(start, item.text.length));
                continue;
            }
            const keyColumn = start + key[1].length;
            this.emit('NAME', key[2], keyColumn);
            this.emit(':', ':', keyColumn + key[2].length + key[3].length);
            const value = item.text.substring(key[0].length);
            const valueStart = start + key[0].length + (value.length - value.trimStart().length);
            this.lexStatement(this.span(valueStart, value.trim().length));
        }
        if (closed) {
            this.emit('}', '}', column + text.length - 1);
        }
    }

    /** Hands a piece of the text to the statement lexer and moves its tokens to their place in the file. */
    private lexStatement(source: Span): void {
        if (source.end <= source.start.offset) {
            return;
        }
        const start = source.start;
        const result = this.statementLexer.tokenize(this.text.substring(start.offset, source.end));
        const move = (token: IToken): IToken => {
            token.startOffset += start.offset;
            token.endOffset! += start.offset;
            if (token.startLine === 1) {
                token.startColumn! += start.column - 1;
            }
            if (token.endLine === 1) {
                token.endColumn! += start.column - 1;
            }
            token.startLine! += start.line - 1;
            token.endLine! += start.line - 1;
            return token;
        };
        this.tokens.push(...result.tokens.map(move));
        for (const token of result.tokens.filter(each => each.tokenType.name === 'QUOTED_ID')) {
            const problem = unsupportedName(token.image);
            if (problem) {
                this.errors.push({ message: problem, offset: token.startOffset, line: token.startLine!, column: token.startColumn!, length: token.image.length });
            }
        }
        this.hidden.push(...(result.groups.hidden ?? []).map(move));
        for (const error of result.errors) {
            const offset = start.offset + error.offset;
            this.errors.push({
                message: `Unexpected character "${this.text.substring(offset, offset + error.length)}".`,
                offset,
                line: start.line + error.line! - 1,
                column: error.line === 1 ? start.column + error.column! - 1 : error.column,
                length: error.length,
            });
        }
    }

    private emit(type: string, image: string, column: number): void {
        const start = this.position(column);
        this.emitAt(type, start, { offset: start.offset + image.length, line: start.line, column: start.column + image.length });
    }

    /** Adds a token that covers the text from `start` up to, and not including, `end`. */
    private emitAt(type: string, start: Position, end: Position): void {
        this.tokens.push(createTokenInstance(this.definition[type], this.text.substring(start.offset, end.offset),
            start.offset, end.offset - 1, start.line, end.line, start.column, end.column - 1));
    }

    private error(message: string, column: number, length: number): void {
        const start = this.position(column);
        this.errors.push({ message, offset: start.offset, line: start.line, column: start.column, length });
    }

    private position(column: number): Position {
        return { offset: this.lineOffset + column, line: this.lineNumber, column: column + 1 };
    }

    private get top(): Level {
        return this.levels[this.levels.length - 1];
    }
}
