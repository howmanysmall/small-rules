import { compareStrings, getPairKey } from "./types";

import type { GeneratedEdge } from "./render";

export type RelationIdentity = Pick<GeneratedEdge, "from" | "kind" | "to">;

export interface RelationChange {
	readonly current: RelationIdentity;
	readonly previous: RelationIdentity;
}

export interface RelationBaselineComparison {
	readonly added: ReadonlyArray<RelationIdentity>;
	readonly changed: ReadonlyArray<RelationChange>;
	readonly currentRelationCount: number;
	readonly description: string;
	readonly previousRelationCount: number;
	readonly removed: ReadonlyArray<RelationIdentity>;
	readonly unchangedRelationCount: number;
}

interface CompareOptions {
	readonly current: ReadonlyArray<GeneratedEdge>;
	readonly previous: ReadonlyArray<GeneratedEdge>;
}

function toIdentity(edge: GeneratedEdge): RelationIdentity {
	return { from: edge.from, kind: edge.kind, to: edge.to };
}

function isSameRelation(left: GeneratedEdge, right: GeneratedEdge): boolean {
	return left.from === right.from && left.kind === right.kind && left.to === right.to;
}

export function compareRelationBaseline(options: CompareOptions): RelationBaselineComparison {
	const currentByPair = new Map(options.current.map((edge) => [getPairKey(edge.from, edge.to), edge]));
	const previousByPair = new Map(options.previous.map((edge) => [getPairKey(edge.from, edge.to), edge]));
	const pairKeys = new Set([...currentByPair.keys(), ...previousByPair.keys()]);
	const added = new Array<RelationIdentity>();
	const changed = new Array<RelationChange>();
	const removed = new Array<RelationIdentity>();
	let unchangedRelationCount = 0;

	for (const pairKey of pairKeys.values().toArray().toSorted(compareStrings)) {
		const current = currentByPair.get(pairKey);
		const previous = previousByPair.get(pairKey);
		if (current === undefined) {
			if (previous !== undefined) removed.push(toIdentity(previous));
		} else if (previous === undefined) added.push(toIdentity(current));
		else if (isSameRelation(current, previous)) unchangedRelationCount += 1;
		else changed.push({ current: toIdentity(current), previous: toIdentity(previous) });
	}

	return {
		added,
		changed,
		currentRelationCount: options.current.length,
		description:
			"Compares this run with the generated relation file that existed before it. This measures output stability, not correctness.",
		previousRelationCount: options.previous.length,
		removed,
		unchangedRelationCount,
	};
}
