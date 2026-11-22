import { type AstNode, AstUtils, CstUtils, GrammarUtils, type IndexManager, UriUtils, type ValidationAcceptor, type ValidationChecks } from 'langium';
import type { Range } from 'vscode-languageserver-types';
import type {
    ActionEntry, ColumnValue, DoEntry, Expression, FlowMap, FunctionCall, LetDefinition, MigqlAstType, NameEntry, NameList, NameRef, Part, PartEntry, PartsEntry,
    Placeholder, RemovedEnsureColumn, RemovedRenameColumn, Snippet, UidEntry, UpsertEntry,
} from '../generated/ast.js';
import {
    isActionEntry, isColumnValue, isDoEntry, isFlowMap, isInsertEntry, isIntoEntry, isKeyEntry, isNameEntry, isNameList, isNameRef, isNativeEntry,
    isNegativeExpression, isNumberLiteral, isPart, isRequiresDowntimeEntry, isRowsEntry, isSnippet, isStopEntry, isTodoEntry, isUpsertEntry,
} from '../generated/ast.js';
import { type ParameterKind, parameterList } from '../actions/catalogue.js';
import { actionForStatement } from '../actions/from-statement.js';
import { actionName, actionOf, asBoolean, asName, asNames, asType, parametersOf } from '../actions/parameters.js';
import { FUNCTIONS } from '../functions.js';
import type { MigqlServices } from '../migql-module.js';
import { sameName } from '../model/names.js';
import { isConditionName } from '../references/names.js';
import { partsOf, slugOf } from '../model/snippet.js';

export function registerValidationChecks(services: MigqlServices): void {
    const validator = services.validation.MigqlValidator;
    const checks: ValidationChecks<MigqlAstType> = {
        Snippet: [validator.checkSnippetHasOneName, validator.checkKeysAppearOnce],
        NameEntry: [validator.checkFormOfName, validator.checkFileName, validator.checkSlugIsUnique],
        UidEntry: validator.checkUidIsUnique,
        PartsEntry: validator.checkPartNamesAreUnique,
        Part: [validator.checkPartHasOneOperation, validator.checkKeysAppearOnce],
        UpsertEntry: validator.checkUpsert,
        FlowMap: validator.checkFlowMapHoldsSimpleValues,
        FunctionCall: validator.checkFunctionIsKnown,
        ActionEntry: validator.checkActionParameters,
        DoEntry: validator.checkDoHasNoAction,
        NameList: validator.checkNameListIsColumns,
        RemovedEnsureColumn: validator.checkEnsureColumnIsAnAction,
        RemovedRenameColumn: validator.checkRenameColumnIsAnAction,
        LetDefinition: validator.checkDefinitionDoesNotUseItself,
        Placeholder: validator.checkPlaceholderHasTodo,
    };
    services.validation.ValidationRegistry.register(checks, validator);
}

/** Codes of the problems for which the editor offers a quick fix. */
export const IssueCodes = {
    PlaceholderWithoutTodo: 'migql.placeholder-without-todo',
    DoHasAction: 'migql.do-has-action',
} as const;

const FILE_ENDING = '.migql.yaml';
const NAME_FORM = /^\d{8}-\d{4}-[a-z0-9]+(-[a-z0-9]+)*$/;

export class MigqlValidator {

    private readonly index: IndexManager;

    constructor(services: MigqlServices) {
        this.index = services.shared.workspace.IndexManager;
    }

    checkSlugIsUnique(entry: NameEntry, accept: ValidationAcceptor): void {
        const slug = slugOf(AstUtils.getContainerOfType(entry, isSnippet)!);
        for (const other of this.othersWith(entry, slug)) {
            accept('error', `The slug "${slug}" is also used by ${other}. ` +
                'Slugs must be unique in a project, because snippets refer to each other by slug.', { node: entry, property: 'name' });
        }
    }

    checkUidIsUnique(entry: UidEntry, accept: ValidationAcceptor): void {
        for (const other of this.othersWith(entry, entry.value)) {
            accept('error', `The uid "${entry.value}" is also used by ${other}. ` +
                'Every snippet needs a uid of its own; create a new one for the newer snippet.', { node: entry, property: 'value' });
        }
    }

    /** The names of the other files that have an entry of the same kind with the same value. */
    private othersWith(entry: AstNode, value: string | undefined): string[] {
        const own = AstUtils.getDocument(entry).uri.toString();
        return this.index.allElements(entry.$type)
            .filter(description => description.name === value && description.documentUri.toString() !== own)
            .map(description => UriUtils.basename(description.documentUri))
            .toArray();
    }

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
            accept('error', `The part "${part.name}" has no operation. Add one of: do, insert, upsert, native, stop, or an action such as column-set-not-null.`,
                { node: part, property: 'name' });
        } else if (operations.length > 1) {
            accept('error', `The part "${part.name}" has ${operations.length} operations: ${operations.join(', ')}. ` +
                'A part holds exactly one. Move the others into parts of their own.',
                { node: part, property: 'name' });
        }
    }

    checkUpsert(upsert: UpsertEntry, accept: ValidationAcceptor): void {
        const first = upsert.entries[0];
        if (!first) {
            return;
        }
        const missing = (present: boolean, message: string) => {
            if (!present) {
                accept('error', message, { node: first, range: keyRange(first) });
            }
        };
        missing(upsert.entries.some(isIntoEntry), 'An upsert needs "into": the table.');
        missing(upsert.entries.some(isKeyEntry), 'An upsert needs "key": the column, or the list of columns, by which an existing row is found.');
        missing(upsert.entries.some(isRowsEntry), 'An upsert needs "rows": the list of rows.');

        const keys = upsert.entries.filter(isKeyEntry).flatMap(entry => entry.columns);
        for (const row of upsert.entries.filter(isRowsEntry).flatMap(entry => entry.rows).filter(each => each.map)) {
            const given = row.map.values.map(value => value.column);
            const absent = keys.filter(key => !given.some(column => sameName(column, key))).map(key => `"${key}"`);
            if (absent.length > 0) {
                accept('error', `This row has no value for the key column${absent.length > 1 ? 's' : ''} ${absent.join(' and ')}. ` +
                    'Every row of an upsert gives all key columns.', { node: row.map });
            }
        }
    }

    /**
     * `do` runs what was written. Where an action has the same result in a way that does not block the application,
     * the author is told. It is a warning: the author may know that the table is small or that nobody uses the database.
     */
    checkDoHasNoAction(entry: DoEntry, accept: ValidationAcceptor): void {
        const action = actionForStatement(entry.statement);
        if (!action || entry.statement?.$type !== 'AlterTable') {
            return;
        }
        const snippet = AstUtils.getContainerOfType(entry, isSnippet)!;
        const table = entry.statement.table;
        const nobodyUsesTheDatabase = snippet.entries.some(each => isRequiresDowntimeEntry(each) && each.value);
        const tableIsNew = partsOf(snippet).some(part => part.entries.some(each =>
            isDoEntry(each) && each.statement?.$type === 'CreateTable' && sameName(each.statement.name ?? '', table)));
        if (!nobodyUsesTheDatabase && !tableIsNew) {
            accept('warning', `do runs this statement as it is written. ${action.reason} The action "${action.action}" has the same result without that.`,
                { node: entry, property: 'statement', code: IssueCodes.DoHasAction });
        }
    }

    /** The parameters of an action are checked against the catalogue: which exist, which are needed, and what each takes. */
    checkActionParameters(entry: ActionEntry, accept: ValidationAcceptor): void {
        const action = actionOf(entry);
        const name = actionName(entry);
        const allowed = `Its parameters: ${parameterList(action)}.`;
        const seen = new Set<string>();
        for (const given of parametersOf(entry)) {
            const definition = action.parameters.find(each => each.name === given.column);
            if (!given.value) {
                // The parser has reported the value already.
            } else if (!definition) {
                accept('error', `The action "${name}" has no parameter "${given.column}". ${allowed}`, { node: given, property: 'column' });
            } else if (seen.has(given.column)) {
                accept('error', `The parameter "${given.column}" of "${name}" is given twice. ${allowed}`, { node: given, property: 'column' });
            } else if (!hasKind(given.value, definition.kind)) {
                accept('error', `The parameter "${given.column}" of "${name}" takes ${KIND_TEXT[definition.kind]}.`, { node: given, property: 'value' });
            } else if (entry.map && !fitsFlowMap(given.value, definition.kind)) {
                accept('error', 'This value needs the block form. In a flow map { … } a value is a literal, a name or a type without a comma. ' +
                    'Write the action as a block, with one parameter per line.', { node: given, property: 'value' });
            }
            seen.add(given.column);
        }
        const missing = action.parameters.filter(each => each.mandatory && !seen.has(each.name)).map(each => `"${each.name}"`);
        if (missing.length > 0) {
            accept('error', `The action "${name}" needs the parameter${missing.length > 1 ? 's' : ''} ${missing.join(' and ')}. ${allowed}`,
                { node: entry, range: keyRange(entry) });
        }
    }

    checkNameListIsColumns(list: NameList, accept: ValidationAcceptor): void {
        if (!actionOfValue(list)) {
            accept('error', 'A list of names in square brackets is the value of a parameter that takes columns, for example "columns: [book_id, currency]".',
                { node: list });
        }
    }

    checkEnsureColumnIsAnAction(statement: RemovedEnsureColumn, accept: ValidationAcceptor): void {
        const type = statement.column?.type?.$cstNode?.text ?? '';
        accept('error', '"ensure column" is not a statement any more. Use the action in the place of do: ' +
            `column-ensure: { table: ${written(statement, 'table')}, column: ${statement.column ? written(statement.column, 'name') : ''}, type: ${type} }`,
        { node: statement, keyword: 'ensure' });
    }

    checkRenameColumnIsAnAction(statement: RemovedRenameColumn, accept: ValidationAcceptor): void {
        accept('error', '"rename column" is not a statement any more. Use the action in the place of do: ' +
            `column-rename: { table: ${written(statement, 'table')}, from: ${written(statement, 'column')}, to: ${written(statement, 'newName')} }`,
        { node: statement, keyword: 'rename' });
    }

    checkFunctionIsKnown(call: FunctionCall, accept: ValidationAcceptor): void {
        if (isTypeOfAnAction(call)) {
            return;
        }
        if (!(call.name.toLowerCase() in FUNCTIONS)) {
            accept('error', `Unknown function "${call.name}". A snippet may call: ${Object.keys(FUNCTIONS).sort().join(', ')}. ` +
                'They are described in the MigQL notes, migql/functions.md. Anything else belongs in a native part.',
            { node: call, property: 'name' });
        }
    }

    /** YAML splits a flow map at every comma and reads quotes its own way. Only simple values mean the same in both. */
    checkFlowMapHoldsSimpleValues(map: FlowMap, accept: ValidationAcceptor): void {
        if (isActionEntry(map.$container)) {
            return;
        }
        for (const entry of map.values) {
            if (entry.value && !isSimpleValue(entry.value)) {
                accept('error', 'A flow map holds only literals, names and table.column. Write the values in the block form, one line per column.',
                    { node: entry, property: 'value' });
            }
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
    // Only a name of a condition has a definition. Asking a column for one would report it as unknown.
    for (const reference of AstUtils.streamAllContents(current).filter(isNameRef).filter(isConditionName)) {
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
    return isDoEntry(entry) || isActionEntry(entry) || isInsertEntry(entry) || isUpsertEntry(entry) || isNativeEntry(entry) || isStopEntry(entry);
}

const KIND_TEXT: Record<ParameterKind, string> = {
    name: 'a name',
    columns: 'a name, or a list of names in square brackets',
    type: 'a type, such as varchar(200)',
    expression: 'an expression',
    boolean: 'true or false',
};

function hasKind(value: Expression, kind: ParameterKind): boolean {
    switch (kind) {
        case 'name': return asName(value) !== undefined;
        case 'columns': return asNames(value) !== undefined;
        case 'type': return asType(value) !== undefined;
        case 'boolean': return asBoolean(value) !== undefined;
        case 'expression': return !isNameList(value);
    }
}

/** YAML splits a flow map at every comma, so a value with a comma or an operator has to stand on a line of its own. */
function fitsFlowMap(value: Expression, kind: ParameterKind): boolean {
    if (kind === 'type') {
        return (asType(value)?.parameters.length ?? 0) <= 1;
    }
    return isSimpleValue(value);
}

/** A type with details is written like a call: `varchar(200)`. As the type of an action it is no function. */
function isTypeOfAnAction(call: FunctionCall): boolean {
    const entry = actionOfValue(call);
    const given = call.$container as ColumnValue;
    return entry !== undefined && actionOf(entry).parameters.find(each => each.name === given.column)?.kind === 'type';
}

/** The action whose parameter has this value, if the value is one of a parameter. */
function actionOfValue(value: Expression): ActionEntry | undefined {
    const given = value.$container;
    if (!isColumnValue(given)) {
        return undefined;
    }
    const holder = isFlowMap(given.$container) ? given.$container.$container : given.$container;
    return isActionEntry(holder) ? holder : undefined;
}

/** A name as the author wrote it, with its quotes if it has some. */
function written(node: AstNode, property: string): string {
    return GrammarUtils.findNodeForProperty(node.$cstNode, property)?.text ?? '';
}

const SIMPLE_VALUES = new Set(['StringLiteral', 'NumberLiteral', 'DateLiteral', 'NullLiteral', 'BooleanLiteral', 'NameRef', 'ColumnRef', 'Placeholder']);

function isSimpleValue(value: Expression): boolean {
    return SIMPLE_VALUES.has(value.$type) || (isNegativeExpression(value) && isNumberLiteral(value.operand));
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
