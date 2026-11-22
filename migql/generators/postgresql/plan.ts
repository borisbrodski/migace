import type { Plan, PlanCondition, PlanPart, PlanSnippet } from '@migace/core';
import { AstUtils } from 'langium';
import { loadModule, parseSync } from 'libpg-query';
import type { Expression, Part, QuantifierCheck, VerifyEntry } from '../../src/generated/ast.js';
import {
    isBatchEntry, isColumnRef, isExpectRowsEntry, isNativeEntry, isRetiredEntry, isSelect, isStopEntry, isTodoEntry, isUidEntry, isVerifyEntry,
    isWhenEntry,
} from '../../src/generated/ast.js';
import { nameEntry, partsOf, slugOf } from '../../src/model/snippet.js';
import type { Project, ProjectSnippet } from '../../src/project.js';
import { expression } from './expressions.js';
import { generateSteps } from './index.js';
import { name } from './names.js';

/** The snippets of a project cannot be compiled. `problems` says why, one line per problem. */
export class PlanError extends Error {
    constructor(readonly problems: string[]) {
        super(`The project cannot be compiled:\n${problems.join('\n')}`);
    }
}

export interface CompileOptions {
    /** The prefix of the names of the ledger tables. Default: `mig_`. */
    ledgerPrefix?: string;
    /** The fingerprint of the schema that the application expects. */
    fingerprint?: string;
}

/**
 * Compiles the snippets of a project to the plan for PostgreSQL: the snippets in the order of their names,
 * their parts in the order of the file, and for every part its statements, conditions and checks.
 * A project with a problem gives no plan.
 */
export async function compilePlan(project: Project, options: CompileOptions = {}): Promise<Plan> {
    await loadModule();
    const problems = project.problems.filter(problem => problem.severity === 'error')
        .map(problem => `${problem.file}:${problem.line}:${problem.column}: ${problem.message}`);
    if (problems.length > 0) {
        throw new PlanError(problems);
    }
    const snippets = [...project.snippets]
        .sort((a, b) => compareNames(nameEntry(a.snippet)?.name ?? '', nameEntry(b.snippet)?.name ?? ''))
        .map(each => compileSnippet(each, problems));
    if (problems.length > 0) {
        throw new PlanError(problems);
    }
    return {
        ledgerPrefix: options.ledgerPrefix ?? 'mig_',
        ...(options.fingerprint ? { fingerprint: options.fingerprint } : {}),
        snippets: snippets.filter((snippet): snippet is PlanSnippet => snippet !== undefined),
    };
}

/** Snippets run in the order of their names. The order depends on the characters only, never on a locale. */
function compareNames(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

function compileSnippet(source: ProjectSnippet, problems: string[]): PlanSnippet | undefined {
    const snippet = source.snippet;
    const uid = snippet.entries.find(isUidEntry)?.value;
    if (!uid) {
        problems.push(`${source.file}: the snippet has no uid. Every snippet needs one; the ledger knows a snippet by it.`);
    }
    const when = snippet.entries.find(isWhenEntry);
    const retired = snippet.entries.find(isRetiredEntry)?.reason;
    const condition = attempt(() => (when ? conditionOf(when.condition) : undefined), problems, source.file);
    const parts = partsOf(snippet).map(part => attempt(() => compilePart(part, source.checksums.get(part.name) ?? ''), problems, `${source.file}, part "${part.name}"`));
    return {
        uid: uid ?? '',
        name: nameEntry(snippet)!.name,
        slug: slugOf(snippet)!,
        ...(retired ? { retired } : {}),
        ...(condition ? { when: condition } : {}),
        parts: parts.filter((part): part is PlanPart => part !== undefined),
    };
}

/** Collects the problem of one snippet or part, so that all problems of a project are reported together. */
function attempt<T>(compile: () => T, problems: string[], place: string): T | undefined {
    try {
        return compile();
    } catch (error) {
        problems.push(`${place}: ${error instanceof Error ? error.message : String(error)}`);
        return undefined;
    }
}

function compilePart(part: Part, checksum: string): PlanPart {
    const todo = part.entries.find(isTodoEntry);
    if (todo) {
        throw new Error(`a todo is left: ${todo.text}`);
    }
    for (const [isUnsupported, key] of [[isBatchEntry, 'batch'], [isExpectRowsEntry, 'expect-rows']] as const) {
        if (part.entries.some(isUnsupported)) {
            throw new Error(`"${key}" is not built yet. Remove it for now.`);
        }
    }
    const when = part.entries.find(isWhenEntry);
    const stop = part.entries.find(isStopEntry);
    const checks = (kind: string) => part.entries.filter(isVerifyEntry).filter(entry => entry.kind === kind).flatMap(checksOf);
    return {
        name: part.name,
        checksum,
        ...(when ? { when: conditionOf(when.condition) } : {}),
        verifyBefore: checks('verify-before:'),
        verifyAfter: checks('verify-after:'),
        ...(stop ? { stop: stop.message.trimEnd() } : {}),
        steps: stop ? [] : stepsOf(part),
    };
}

function stepsOf(part: Part): PlanPart['steps'] {
    const steps = generateSteps(part);
    if (part.entries.some(isNativeEntry)) {
        checkIsOneStatement(steps[0].sql);
    }
    return steps.map(step => ({ sql: step.sql, outsideTransaction: step.outsideTransaction ?? false, ...(step.cleanup ? { cleanup: step.cleanup } : {}) }));
}

/** Native SQL is sent as one statement. Whether it is one is asked of PostgreSQL's own parser. */
function checkIsOneStatement(sql: string): void {
    let statements: number;
    try {
        statements = parseSync(sql).stmts?.length ?? 0;
    } catch (error) {
        throw new Error(`PostgreSQL cannot read the native SQL: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (statements !== 1) {
        throw new Error(`the native SQL has ${statements} statements. A part is one statement or one block; write two parts.`);
    }
}

function conditionOf(node: Expression): PlanCondition {
    return { text: sourceText(node), sql: expression(node) };
}

function checksOf(entry: VerifyEntry): PlanCondition[] {
    return entry.condition ? [conditionOf(entry.condition)] : entry.checks.map(checkOnRows);
}

/** A check on the rows of one table. The table is the one that stands in front of the columns of the condition. */
function checkOnRows(check: QuantifierCheck): PlanCondition {
    const quantifier = check.quantifier.slice(0, -1);
    const text = `${quantifier}: ${sourceText(check.condition)}`;
    const tables = [...new Set(AstUtils.streamAst(check.condition)
        .filter(isColumnRef)
        .filter(reference => !AstUtils.hasContainerOfType(reference, isSelect))
        .map(reference => reference.table))];
    if (tables.length === 0) {
        throw new Error(`the check "${text}" names no table. Write the table in front of a column: orders.status_id is not null.`);
    }
    if (tables.length > 1) {
        throw new Error(`the check "${text}" names the tables ${tables.join(' and ')}. A check on rows looks at one table.`);
    }
    const from = `from ${name(tables[0])} where (${expression(check.condition)})`;
    switch (quantifier) {
        case 'all': return { text, sql: `not exists (select 1 ${from} is not true)` };
        case 'none': return { text, sql: `not exists (select 1 ${from})` };
        case 'exists': return { text, sql: `exists (select 1 ${from})` };
        default: return { text, sql: `(select count(*) ${from}) = 1` };
    }
}

/** A condition as the author wrote it, on one line. */
function sourceText(node: Expression): string {
    return (node.$cstNode?.text ?? '').replace(/\s+/g, ' ').trim();
}
