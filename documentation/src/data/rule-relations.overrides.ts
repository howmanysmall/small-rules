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

export const relationPins = defineRelationPins([
	{
		from: "directive-no-use",
		kind: "supersedes",
		reason: "This bans every block disable, so requiring those disables to have matching enables no longer adds anything.",
		to: "directive-disable-enable-pair",
	},
	{
		from: "no-print",
		kind: "related",
		reason: "Same banned-global factory: raw print/warn output should become structured Log calls.",
		to: "no-warn",
	},
	{
		from: "prefer-constant-dispatch",
		kind: "depends-on",
		reason: "Constant dispatch values only apply once related state has moved into a reducer.",
		to: "prefer-use-reducer",
	},
]);
export const relationDenylist = defineRelationDenylist([]);
