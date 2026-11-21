import { EmptyFileSystem, URI } from 'langium';
import { clearDocuments, parseHelper } from 'langium/test';
import { afterEach } from 'vitest';
import { DocumentIssueSeverity, DocumentIssueSource } from 'langium-tools/base';
import { type IssueExpectation, parseWithMarks } from 'langium-tools/testing';
import { createMigqlServices } from '../src/migql-module.js';
import type { Snippet } from '../src/generated/ast.js';

/**
 * One set of services for a test file.
 * Importing `langium-tools/testing` registers the document matchers on vitest's `expect`.
 */
export function createMigql() {
    const services = createMigqlServices(EmptyFileSystem);
    // Documents of one test must not be seen by the next: snippets of a project know each other.
    afterEach(() => clearDocuments(services.shared));
    const parseText = parseHelper<Snippet>(services.migql);
    let count = 0;
    /** Gives the document the file name that its snippet name asks for, each in a folder of its own. */
    const parse: typeof parseText = (text, options) => {
        const name = /^(?:migration|repair):[ ]+(\S+)/m.exec(text)?.[1] ?? 'unnamed';
        const documentUri = URI.file(`/test-${++count}/${name}.migql.yaml`).toString();
        return parseText(text, { documentUri, ...options });
    };
    return {
        services,
        /** The token stream as text: `NAME(image)` for terminals, the image alone for keywords. */
        tokens: (text: string): string[] => {
            const result = services.migql.parser.Lexer.tokenize(text);
            return result.tokens.map(token =>
                token.tokenType.name === token.image ? token.image : `${token.tokenType.name}(${token.image})`);
        },
        /** The token stream of a text that ends at the cursor, as the completion asks for it. */
        partialTokens: (text: string): string[] => {
            const result = services.migql.parser.Lexer.tokenize(text, { mode: 'partial' });
            return result.tokens.map(token =>
                token.tokenType.name === token.image ? token.image : `${token.tokenType.name}(${token.image})`);
        },
        /** The tokens with their place in the file: `image@line:column`. */
        positions: (text: string): string[] => {
            const result = services.migql.parser.Lexer.tokenize(text);
            return result.tokens.map(token => `${token.image}@${token.startLine}:${token.startColumn}+${token.startOffset}`);
        },
        /** The problems the lexer reports, as `message@line:column+length`. */
        lexerErrors: (text: string): string[] => {
            const result = services.migql.parser.Lexer.tokenize(text);
            return result.errors.map(error => `${error.message}@${error.line}:${error.column}+${error.length}`);
        },
        /** Parse only. */
        parse,
        /** Forgets the documents parsed so far. For a test that parses several versions of one snippet. */
        clear: () => clearDocuments(services.shared),
        /** Strip `<<{|` … `|}>>`, parse and validate. The markers are the expected ranges. */
        parseMarked: (text: string) => parseWithMarks(parse, text),
        /** Parse and validate. */
        validate: (text: string) => parse(text, { validation: true }),
    };
}

/**
 * Every problem of a document is a diagnostic with a range. Lexer and parser problems are
 * listed a second time without their end; the tests leave that copy out.
 */
export const DIAGNOSTICS_ONLY = { ignoreLexerErrors: true, ignoreParserErrors: true };

export function error(message: string | RegExp, markerId: number): IssueExpectation {
    return { source: DocumentIssueSource.VALIDATION, severity: DocumentIssueSeverity.ERROR, message, markerId };
}

/** Lines of a snippet as one text. Keeps the indentation of the test source out of the snippet. */
export function lines(...text: string[]): string {
    return text.join('\n') + '\n';
}
