/**
 * The catalogue of actions. An action is an operation for which MIG-Ace chooses the statements.
 * It stands in a part in the place of `do`, and its parameters are YAML keys.
 *
 * The lexer, the checks, the completion and the YAML schema all read these definitions.
 * The descriptions for people are in `constructs/<action>/construct.md`.
 */

/**
 * `name`: one name. `columns`: one name or a list of names. `type`: a type, such as `varchar(200)`.
 * `expression`: an expression of the statement language. `boolean`: `true` or `false`.
 */
export type ParameterKind = 'name' | 'columns' | 'type' | 'expression' | 'boolean';

export interface ActionParameter {
    name: string;
    kind: ParameterKind;
    mandatory: boolean;
}

export interface Action {
    name: string;
    parameters: ActionParameter[];
}

const mandatory = (name: string, kind: ParameterKind = 'name'): ActionParameter => ({ name, kind, mandatory: true });
const optional = (name: string, kind: ParameterKind): ActionParameter => ({ name, kind, mandatory: false });

/** In the order of their names, which is the order in which an editor lists them. */
export const ACTIONS: Action[] = [
    {
        name: 'column-ensure',
        parameters: [mandatory('table'), mandatory('column'), mandatory('type', 'type'), optional('default', 'expression'), optional('not-null', 'boolean')],
    },
    { name: 'column-rename', parameters: [mandatory('table'), mandatory('from'), mandatory('to')] },
    { name: 'column-set-not-null', parameters: [mandatory('table'), mandatory('column')] },
    { name: 'constraint-add-check', parameters: [mandatory('name'), mandatory('table'), mandatory('check', 'expression')] },
    {
        name: 'constraint-add-foreign-key',
        parameters: [mandatory('name'), mandatory('table'), mandatory('columns', 'columns'), mandatory('references'), optional('referenced-columns', 'columns')],
    },
];

export function actionNamed(name: string): Action | undefined {
    return ACTIONS.find(action => action.name === name);
}

/** The parameters of an action as a message lists them: optional ones in square brackets. */
export function parameterList(action: Action): string {
    return action.parameters.map(parameter => (parameter.mandatory ? parameter.name : `[${parameter.name}]`)).join(', ');
}
