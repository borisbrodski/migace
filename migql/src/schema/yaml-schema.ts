import { AstUtils, type Grammar, GrammarAST } from 'langium';
import { type Action, ACTIONS, type ParameterKind } from '../actions/catalogue.js';
import { ACTION_DESCRIPTIONS } from '../actions/descriptions.js';
import { type Context, type KeySpec, partBody, snippetContext } from '../lexer/envelope-schema.js';

type Schema = Record<string, unknown>;

/** One value on a line: a text, a number, `true`, `false` or nothing. A statement is a text for the schema. */
const SINGLE_VALUE: Schema = { type: ['string', 'number', 'boolean', 'null'] };
const NAMES: Schema = { anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' }, minItems: 1 }] };

const PARAMETER: Record<ParameterKind, Schema> = {
    name: { type: 'string' },
    columns: NAMES,
    type: { type: 'string' },
    expression: { type: ['string', 'number', 'boolean'] },
    boolean: { type: 'boolean' },
};

/**
 * A JSON Schema for `*.migql.yaml`, built from the definitions that the lexer uses for the keys and from
 * the catalogue of actions. With it a YAML editor without the MigQL language server completes the keys,
 * shows their descriptions and reports a wrong, a missing or an unknown key.
 */
export function yamlSchema(grammar: Grammar): Schema {
    const explanations = explanationsOfKeys(grammar);
    const context = (definition: Context, isPartBody = false): Schema => {
        if (definition.flowItems) {
            return { type: 'object', additionalProperties: SINGLE_VALUE };
        }
        if (definition.keys) {
            return {
                type: 'object',
                properties: Object.fromEntries(Object.entries(definition.keys).map(([name, spec]) => [name, key(name, spec, isPartBody)])),
                additionalProperties: false,
                ...(definition.required ? { required: definition.required } : {}),
            };
        }
        if (definition.names?.children === partBody) {
            // A part: its name, and below it the body.
            return { type: 'object', additionalProperties: { $ref: '#/$defs/part' }, minProperties: 1, maxProperties: 1 };
        }
        return { type: 'object', additionalProperties: definition.names ? key('', definition.names, false) : SINGLE_VALUE };
    };
    const key = (name: string, spec: KeySpec, inPart: boolean): Schema => {
        const action = inPart ? ACTIONS.find(each => each.name === name) : undefined;
        if (action) {
            return actionSchema(action);
        }
        const nested = spec.children ? context(spec.children) : undefined;
        const below = nested && spec.list ? { type: 'array', items: nested } : nested;
        const value = spec.value ? valueSchema(spec) : undefined;
        const schema = value && below ? { anyOf: [value, below] } : value ?? below ?? SINGLE_VALUE;
        return explanations.has(name) ? { description: explanations.get(name), ...schema } : schema;
    };
    return {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        title: 'MigQL snippet',
        description: 'A migration snippet of MIG-Ace: a file that ends in .migql.yaml.',
        ...context(snippetContext),
        anyOf: [{ required: ['migration'] }, { required: ['repair'] }],
        $defs: { part: context(partBody, true) },
    };
}

function valueSchema(spec: KeySpec): Schema {
    if (spec.words) {
        return { enum: spec.words };
    }
    switch (spec.yaml) {
        case 'text': return { type: 'string' };
        case 'boolean': return { type: 'boolean' };
        case 'names': return NAMES;
        default: return spec.value === 'text' ? { type: 'string' } : SINGLE_VALUE;
    }
}

function actionSchema(action: Action): Schema {
    const description = ACTION_DESCRIPTIONS[action.name];
    return {
        description: description.description,
        type: 'object',
        properties: Object.fromEntries(action.parameters.map(parameter =>
            [parameter.name, { description: description.parameters[parameter.name], ...PARAMETER[parameter.kind] }])),
        required: action.parameters.filter(parameter => parameter.mandatory).map(parameter => parameter.name),
        additionalProperties: false,
    };
}

/** The comment that stands in front of a key in the grammar, for every key that has one. */
function explanationsOfKeys(grammar: Grammar): Map<string, string> {
    const explanations = new Map<string, string>();
    for (const keyword of AstUtils.streamAllContents(grammar).filter(GrammarAST.isKeyword)) {
        const comment = (keyword as { $comment?: string }).$comment;
        const name = keyword.value.slice(0, -1);
        if (comment && keyword.value.endsWith(':') && !explanations.has(name)) {
            explanations.set(name, comment.replace(/^\/\*\*\s*|\s*\*\/$/g, '').replace(/\s*\n\s*\*\s?/g, ' ').trim());
        }
    }
    return explanations;
}
