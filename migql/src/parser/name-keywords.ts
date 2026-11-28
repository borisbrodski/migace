import { AstUtils, type Grammar, GrammarAST } from 'langium';

/** The keywords that the grammar also accepts as names without quotes: the keywords of the rule `Name`. */
export function nameKeywords(grammar: Grammar): Set<string> {
    const nameRule = grammar.rules.find(rule => rule.name === 'Name')!;
    return new Set(AstUtils.streamAllContents(nameRule).filter(GrammarAST.isKeyword).map(keyword => keyword.value));
}
