import { mergeRelations, parseGeneratedRelations } from "$data/rule-relations";

import { getPairKey } from "./types";

import type { GeneratedRelation, RuleRelation, RuleRelationPair } from "$data/rule-relations";

interface CheckOptions {
	readonly denylist: ReadonlyArray<RuleRelationPair>;
	readonly edges: ReadonlyArray<GeneratedRelation>;
	readonly maxRelationsPerRule: number;
	readonly pins: ReadonlyArray<RuleRelation>;
}

export function checkRelationsDocument(options: CheckOptions): ReadonlyArray<string> {
	const problems = new Array<string>();

	let relations: ReadonlyArray<RuleRelation>;
	try {
		relations = parseGeneratedRelations(options.edges);
	} catch (error) {
		return [error instanceof Error ? error.message : "Unreadable relation document."];
	}

	const seenPinPairs = new Set<string>();
	for (const pin of options.pins) {
		const pairKey = getPairKey(pin.from, pin.to);
		if (seenPinPairs.has(pairKey)) problems.push(`Duplicate pin for ${pin.from} ↔ ${pin.to}.`);
		seenPinPairs.add(pairKey);
	}

	const deniedPairs = new Set(options.denylist.map((pair) => getPairKey(pair.from, pair.to)));
	for (const pin of options.pins) {
		if (deniedPairs.has(getPairKey(pin.from, pin.to))) {
			problems.push(`Pin for ${pin.from} ↔ ${pin.to} is also on the denylist.`);
		}
	}

	const counts = new Map<string, number>();
	for (const relation of mergeRelations(relations, options.pins, options.denylist)) {
		counts.set(relation.from, (counts.get(relation.from) ?? 0) + 1);
		counts.set(relation.to, (counts.get(relation.to) ?? 0) + 1);
	}

	for (const [name, count] of counts) {
		if (count > options.maxRelationsPerRule) {
			problems.push(`Rule "${name}" has ${count} relations (maximum ${options.maxRelationsPerRule}).`);
		}
	}

	return problems;
}
