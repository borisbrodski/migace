import { type AstNode, CstUtils, UriUtils, AstUtils, type ValidationAcceptor, type ValidationChecks } from 'langium';
import type { Range } from 'vscode-languageserver-types';
import type { FillEntry, LetDefinition, MigqlAstType, NameEntry, NameRef, Part, PartEntry, PartsEntry, PhaseEntry, Placeholder, Snippet } from '../generated/ast.js';
import { isDoEntry, isInsertEntry, isNameEntry, isNameRef, isNativeEntry, isPart, isStopEntry, isTodoEntry } from '../generated/ast.js';
import type { MigqlServices } from '../migql-module.js';

export function registerValidationChecks(services: MigqlServices): void {
    const validator = services.validation.MigqlValidator;
    const checks: ValidationChecks<MigqlAstType> = {
        Snippet: [validator.checkSnippetHasOneName, validator.checkKeysAppearOnce],
        NameEntry: [validator.checkFormOfName, validator.checkFileName],
        PartsEntry: validator.checkPartNamesAreUnique,
        Part: [validator.checkPartHasOneOperation, validator.checkKeysAppearOnce],
        PhaseEntry: validator.checkPhase,
        LetDefinition: validator.checkDefinitionDoesNotUseItself,
        FillEntry: validator.checkFillMode,
        Placeholder: validator.checkPlaceholderHasTodo,
    };
    services.validation.ValidationRegistry.register(checks, validator);
}

/** Codes of the problems for which the editor offers a quick fix. */
export const IssueCodes = {
    PlaceholderWithoutTodo: 'migql.placeholder-without-todo',
} as const;

const FILE_ENDING = '.migql.yaml';
const NAME_FORM = /^\d{8}-\d{4}-[a-z0-9]+(-[a-z0-9]+)*$/;

export class MigqlValidator {

    checkSnippetHasOneName(snippet: Snippet, accept: ValidationAcceptor): void {
        const [first, ...others] = snippet.entries.filter(isNameEntry);
        if (!first) {
            const place: AstNode = snippet.entries[0] ?? snippet;
            accept('error', 'A snippet needs a name. Add "migration: <name>", or "repair: <name>" for a repair snippet.',
                { node: place, range: place === snippet ? undefined : keyRange(place) });
        }
        for (const other of others) {
            accept('error', 'A snippet has either "migration" or "repair", and only once. Remove this line.',
                { node: other, range: keyRange(other) });
        }
    }

    checkKeysAppearOnce(container: Snippet | Part, accept: ValidationAcceptor): void {
        const seen = new Set<string>();
        for (const entry of container.entries) {
            if (isNameEntry(entry)) {
                continue;
            }
            const key = keyOf(entry);
            if (seen.has(key)) {
                accept('error', `The key "${key}" appears twice. Keep one of them.`, { node: entry, range: keyRange(entry) });
            }
            seen.add(key);
        }
    }

    checkFormOfName(entry: NameEntry, accept: ValidationAcceptor): void {
        if (!NAME_FORM.test(entry.name)) {
            accept('error', 'The name of a snippet has the form YYYYMMDD-HHMM-slug, for example 20260309-1400-review-table.',
                { node: entry, property: 'name' });
        }
    }

    checkFileName(entry: NameEntry, accept: ValidationAcceptor): void {
        const fileName = UriUtils.basename(AstUtils.getDocument(entry).uri);
        const expected = entry.name + FILE_ENDING;
        if (NAME_FORM.test(entry.name) && fileName !== expected) {
            accept('error', `The file of this snippet must be named "${expected}". It is named "${fileName}".`,
                { node: entry, property: 'name' });
        }
    }

    checkPartNamesAreUnique(entry: PartsEntry, accept: ValidationAcceptor): void {
        const seen = new Set<string>();
        for (const part of entry.parts) {
            if (seen.has(part.name)) {
                accept('error', `The part name "${part.name}" is already used in this snippet. Part names must be unique.`,
                    { node: part, property: 'name' });
            }
            seen.add(part.name);
        }
    }

    checkPartHasOneOperation(part: Part, accept: ValidationAcceptor): void {
        const operations = part.entries.filter(isOperation).map(keyOf);
        if (operations.length === 0) {
            accept('error', `The part "${part.name}" has no operation. Add one of: do, insert, native, stop.`,
                { node: part, property: 'name' });
        } else if (operations.length > 1) {
            accept('error', `The part "${part.name}" has ${operations.length} operations: ${operations.join(', ')}. ` +
                'A part holds exactly one. Move the others into parts of their own.',
                { node: part, property: 'name' });
        }
    }

    checkPhase(entry: PhaseEntry, accept: ValidationAcceptor): void {
        if (entry.phase !== 'finish') {
            accept('error', 'The only phase to write is "finish". A part without a phase runs in the start phase.',
                { node: entry, property: 'phase' });
        }
    }

    checkFillMode(entry: FillEntry, accept: ValidationAcceptor): void {
        if (entry.mode !== 'all' && entry.mode !== 'required') {
            accept('error', 'The fill mode is "all" (every column has a value) or "required" (only mandatory columns).',
                { node: entry, property: 'mode' });
        }
    }

    checkPlaceholderHasTodo(placeholder: Placeholder, accept: ValidationAcceptor): void {
        const part = AstUtils.getContainerOfType(placeholder, isPart);
        if (!part?.entries.some(isTodoEntry)) {
            accept('error', 'A "?" stands for a value that is not decided yet. Write the value, or add "todo: <what is open>" to the part.',
                { node: placeholder, code: IssueCodes.PlaceholderWithoutTodo });
        }
    }

    checkDefinitionDoesNotUseItself(definition: LetDefinition, accept: ValidationAcceptor): void {
        const cycle = findCycle(definition, definition, []);
        if (cycle) {
            const path = [definition, ...cycle.map(reference => reference.target.ref!)].map(step => step.name).join(' → ');
            accept('error', `The condition "${definition.name}" refers to itself: ${path}.`, { node: cycle[0], property: 'target' });
        }
    }
}

/** The names used on the way from `current` back to `start`, or nothing if there is no such way. */
function findCycle(start: LetDefinition, current: LetDefinition, visited: LetDefinition[]): NameRef[] | undefined {
    for (const reference of AstUtils.streamAllContents(current).filter(isNameRef)) {
        const target = reference.target.ref;
        if (target === start) {
            return [reference];
        }
        if (target && !visited.includes(target)) {
            const rest = findCycle(start, target, [...visited, target]);
            if (rest) {
                return [reference, ...rest];
            }
        }
    }
    return undefined;
}

function isOperation(entry: PartEntry): boolean {
    return isDoEntry(entry) || isInsertEntry(entry) || isNativeEntry(entry) || isStopEntry(entry);
}

/** The key token of an entry, such as `uid:`. Every entry starts with it. */
function keyNode(entry: AstNode) {
    const node = entry.$cstNode!;
    return CstUtils.findLeafNodeAtOffset(node, node.offset)!;
}

/** The key of an entry as the author wrote it, without the colon. */
function keyOf(entry: AstNode): string {
    return keyNode(entry).text.slice(0, -1);
}

function keyRange(entry: AstNode): Range {
    const { start, end } = keyNode(entry).range;
    return { start, end: { line: end.line, character: end.character - 1 } };
}
