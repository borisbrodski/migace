import * as fs from 'node:fs';
import * as path from 'node:path';
import { type LangiumDocument, URI } from 'langium';
import { NodeFileSystem } from 'langium/node';
import { DiagnosticSeverity } from 'vscode-languageserver-types';
import { type Checksum, partChecksums } from './checksum/checksum.js';
import type { Snippet } from './generated/ast.js';
import { createMigqlServices } from './migql-module.js';

const FILE_ENDING = '.migql.yaml';

export interface Problem {
    /** The file, relative to the folder of the project, with `/` between folders. */
    file: string;
    /** Line and column start at 1. */
    line: number;
    column: number;
    severity: 'error' | 'warning' | 'info' | 'hint';
    message: string;
}

/** One snippet file of a project. */
export interface ProjectSnippet {
    /** The file, relative to the folder of the project. */
    file: string;
    snippet: Snippet;
    /** The checksum of every part, by the name of the part. */
    checksums: Map<string, Checksum>;
}

export interface Project {
    /** The snippet files of the project, relative to its folder, in the order of their names. */
    readonly files: string[];
    /** The snippets of the project, in the order of their files. */
    readonly snippets: ProjectSnippet[];
    /** The problems of all files, ordered by file and place. */
    readonly problems: Problem[];
    /** Reads again what changed on disk and runs the checks again. */
    refresh(): Promise<void>;
}

/**
 * Loads every snippet file below a folder as one project.
 * A file with problems does not stop the others: the problems of all files are collected.
 */
export async function loadProject(folder: string): Promise<Project> {
    const { shared, migql } = createMigqlServices(NodeFileSystem);
    const documents = shared.workspace.LangiumDocuments;
    const builder = shared.workspace.DocumentBuilder;
    const root = path.resolve(folder);
    const relative = (document: LangiumDocument) => path.relative(root, document.uri.fsPath).split(path.sep).join('/');

    const project = {
        files: [] as string[],
        snippets: [] as ProjectSnippet[],
        problems: [] as Problem[],
        async refresh(): Promise<void> {
            const onDisk = new Map(snippetFiles(root).map(file => [URI.file(file).toString(), file]));
            const deleted = documents.all.filter(document => !onDisk.has(document.uri.toString())).map(document => document.uri).toArray();
            const changed = [...onDisk].filter(([uri, file]) => {
                const loaded = documents.getDocument(URI.parse(uri));
                return !loaded || loaded.textDocument.getText() !== fs.readFileSync(file, 'utf8');
            }).map(([uri]) => URI.parse(uri));
            await builder.update(changed, deleted);
            await builder.build(documents.all.toArray(), { validation: true });
            const loaded = documents.all.toArray().sort((a, b) => relative(a).localeCompare(relative(b)));
            project.files = loaded.map(relative);
            project.snippets = loaded.map(document => ({
                file: relative(document),
                snippet: document.parseResult.value as Snippet,
                checksums: partChecksums(migql.parser.Lexer.tokenize(document.textDocument.getText()).tokens),
            }));
            project.problems = loaded.flatMap(document => problemsOf(document, relative(document)));
        },
    };
    await project.refresh();
    return project;
}

function snippetFiles(folder: string): string[] {
    return fs.readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
        const file = path.join(folder, entry.name);
        if (entry.isDirectory()) {
            return entry.name === 'node_modules' || entry.name.startsWith('.') ? [] : snippetFiles(file);
        }
        return entry.name.endsWith(FILE_ENDING) ? [file] : [];
    });
}

const SEVERITY = {
    [DiagnosticSeverity.Error]: 'error',
    [DiagnosticSeverity.Warning]: 'warning',
    [DiagnosticSeverity.Information]: 'info',
    [DiagnosticSeverity.Hint]: 'hint',
} as const;

function problemsOf(document: LangiumDocument, file: string): Problem[] {
    return (document.diagnostics ?? [])
        .map(diagnostic => ({
            file,
            line: diagnostic.range.start.line + 1,
            column: diagnostic.range.start.character + 1,
            severity: SEVERITY[diagnostic.severity ?? DiagnosticSeverity.Error],
            message: typeof diagnostic.message === 'string' ? diagnostic.message : diagnostic.message.value,
        }))
        .sort((a, b) => a.line - b.line || a.column - b.column);
}
