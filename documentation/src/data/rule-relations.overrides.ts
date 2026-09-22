/**
 * Hand-curated overrides for the generated relation list.
 *
 * `relationPins` always render and replace any generated relation for the same
 * rule pair. `relationDenylist` suppresses pairs the generator keeps getting
 * wrong. Pins win over denylist entries.
 *
 * Undirected pairs may list either endpoint first.
 */

import type { RuleRelation, RuleRelationPair } from "./rule-relations";

function defineRelationPins<const TRelations extends ReadonlyArray<RuleRelation>>(relations: TRelations): TRelations {
	return relations;
}

function defineRelationDenylist<const TPairs extends ReadonlyArray<RuleRelationPair>>(pairs: TPairs): TPairs {
	return pairs;
}

export const relationPins = defineRelationPins([]);
export const relationDenylist = defineRelationDenylist([]);
