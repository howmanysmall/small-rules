/**
 * Semantic relationships between small-rules.
 *
 * The relation list in `generated/rule-relations.json` is produced by
 * `scripts/regenerate-relations.ts`; never edit it by hand. Manual corrections
 * go into `rule-relations.overrides.ts`.
 *
 * Same-category adjacency is not a relation. Only real problem-family,
 * complementarity, overlap, or conceptual-dependency edges belong here.
 */

import generatedRelations from "./generated/rule-relations.json";
import { ruleManifest } from "./rule-manifest";
import { relationDenylist, relationPins } from "./rule-relations.overrides";

import type { RuleName } from "./rule-manifest";

function defineRelationKinds<const TKinds extends ReadonlyArray<string>>(kinds: TKinds): TKinds {
	return kinds;
}

const directedRelationKinds = defineRelationKinds(["depends-on", "supersedes"]);
const undirectedRelationKinds = defineRelationKinds(["overlaps", "related"]);
const relationKindNames = new Set<string>([...directedRelationKinds, ...undirectedRelationKinds]);
const directedKindNames = new Set<string>(directedRelationKinds);

export type DirectedRuleRelationKind = (typeof directedRelationKinds)[number];
type UndirectedRuleRelationKind = (typeof undirectedRelationKinds)[number];
export type RuleRelationKind = DirectedRuleRelationKind | UndirectedRuleRelationKind;

export interface RuleRelation {
	readonly from: RuleName;
	readonly kind: RuleRelationKind;
	readonly reason: string;
	readonly to: RuleName;
}

export interface RuleRelationPair {
	readonly from: RuleName;
	readonly to: RuleName;
}

export interface GeneratedRelation {
	readonly evidence?: unknown;
	readonly from: string;
	readonly kind: string;
	readonly reason: string;
	readonly to: string;
}

const ruleNames = new Set<string>(
	ruleManifest.categories.flatMap((category) => category.rules.map((entry) => entry.name)),
);

export function isDirectedKind(kind: RuleRelationKind): kind is DirectedRuleRelationKind {
	return directedKindNames.has(kind);
}

export function isRuleRelationKind(value: string): value is RuleRelationKind {
	return relationKindNames.has(value);
}

export function isRuleName(value: string): value is RuleName {
	return ruleNames.has(value);
}

function getPairKey(from: string, to: string): string {
	return [from, to].toSorted().join(":");
}

function parseGeneratedRelation(edge: GeneratedRelation): RuleRelation {
	if (!isRuleName(edge.from)) {
		throw new Error(`Unknown rule name "${edge.from}".`);
	}
	if (!isRuleName(edge.to)) {
		throw new Error(`Unknown rule name "${edge.to}".`);
	}
	if (edge.from === edge.to) {
		throw new Error(`Self-relation for ${edge.from}.`);
	}
	if (!isRuleRelationKind(edge.kind)) {
		throw new Error(`Unknown relation kind "${edge.kind}" for ${edge.from} → ${edge.to}.`);
	}

	const undirected = !isDirectedKind(edge.kind) && edge.to < edge.from;
	return {
		from: undirected ? edge.to : edge.from,
		kind: edge.kind,
		reason: edge.reason,
		to: undirected ? edge.from : edge.to,
	};
}

export function parseGeneratedRelations(edges: ReadonlyArray<GeneratedRelation>): ReadonlyArray<RuleRelation> {
	const relations = new Array<RuleRelation>();
	const seenPairs = new Set<string>();

	for (const edge of edges) {
		const relation = parseGeneratedRelation(edge);
		const pairKey = getPairKey(relation.from, relation.to);
		if (seenPairs.has(pairKey)) {
			throw new Error(`Duplicate relation for ${pairKey.replace(":", " ↔ ")}.`);
		}
		seenPairs.add(pairKey);
		relations.push(relation);
	}

	return relations;
}

export function mergeRelations(
	generated: ReadonlyArray<RuleRelation>,
	pins: ReadonlyArray<RuleRelation>,
	denylist: ReadonlyArray<RuleRelationPair>,
): ReadonlyArray<RuleRelation> {
	const pinsByPair = new Map(pins.map((pin) => [getPairKey(pin.from, pin.to), pin]));
	const deniedPairs = new Set(denylist.map((pair) => getPairKey(pair.from, pair.to)));
	const placedPairs = new Set<string>();

	const relations = new Array<RuleRelation>();
	for (const relation of generated) {
		const pairKey = getPairKey(relation.from, relation.to);
		const pin = pinsByPair.get(pairKey);
		if (pin !== undefined) {
			relations.push(pin);
			placedPairs.add(pairKey);
		} else if (!deniedPairs.has(pairKey)) relations.push(relation);
	}

	for (const pin of pins) {
		const pairKey = getPairKey(pin.from, pin.to);
		if (placedPairs.has(pairKey)) continue;

		relations.push(pin);
		placedPairs.add(pairKey);
	}

	return relations;
}

const relations = mergeRelations(parseGeneratedRelations(generatedRelations.edges), relationPins, relationDenylist);

export function getRelatedRules(ruleName: RuleName): ReadonlyArray<RuleRelation> {
	return relations.filter((relation) => relation.from === ruleName || relation.to === ruleName);
}
