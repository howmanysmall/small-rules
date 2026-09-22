import { compareStrings } from "./types";

import type { RuleName } from "$data/rule-manifest";

import type { JudgmentThresholds, PairJudgments, RelationDraft, RelationResolution, ScoredRelation } from "./types";

interface DirectedCandidate {
	readonly relation: RelationDraft;
	readonly score: number;
}

function getPairStrength(forward: PairJudgments, backward: PairJudgments): number {
	return Math.max(
		forward.duplicates,
		forward.exists,
		forward.replaces,
		forward.requires,
		backward.duplicates,
		backward.exists,
		backward.replaces,
		backward.requires,
	);
}

interface ResolveOptions {
	readonly backward: PairJudgments;
	readonly forward: PairJudgments;
	readonly left: RuleName;
	readonly right: RuleName;
	readonly thresholds: JudgmentThresholds;
}

export function resolvePairRelation({
	backward,
	forward,
	left,
	right,
	thresholds,
}: ResolveOptions): RelationResolution {
	const strength = getPairStrength(forward, backward);

	const directedCandidates = [
		{ relation: { from: left, kind: "supersedes", to: right }, score: forward.replaces },
		{ relation: { from: right, kind: "supersedes", to: left }, score: backward.replaces },
		{ relation: { from: left, kind: "depends-on", to: right }, score: forward.requires },
		{ relation: { from: right, kind: "depends-on", to: left }, score: backward.requires },
	] satisfies ReadonlyArray<DirectedCandidate>;

	const accepted = directedCandidates.filter((candidate) => candidate.score >= thresholds.accept);
	if (accepted.length > 1) return { concern: "conflicting directed judgments", strength, type: "review" };

	const [directed] = accepted;
	if (directed !== undefined) return { relation: directed.relation, strength: directed.score, type: "relation" };

	const duplicates = Math.max(forward.duplicates, backward.duplicates);
	if (duplicates >= thresholds.accept) {
		return { relation: { from: left, kind: "overlaps", to: right }, strength: duplicates, type: "relation" };
	}

	const exists = Math.max(forward.exists, backward.exists);
	if (exists >= thresholds.accept) {
		return { relation: { from: left, kind: "related", to: right }, strength: exists, type: "relation" };
	}

	if (strength >= thresholds.review) return { concern: "near-threshold judgments", strength, type: "review" };
	return { type: "none" };
}

export function applyRelationCap(
	relations: ReadonlyArray<ScoredRelation>,
	maxPerRule: number,
): ReadonlyArray<ScoredRelation> {
	const ordered = relations.toSorted(
		(left, right) =>
			right.strength - left.strength ||
			compareStrings(left.relation.from, right.relation.from) ||
			compareStrings(left.relation.to, right.relation.to) ||
			compareStrings(left.relation.kind, right.relation.kind),
	);

	const counts = new Map<RuleName, number>();
	const kept = new Array<ScoredRelation>();
	for (const scored of ordered) {
		const { from, to } = scored.relation;
		if ((counts.get(from) ?? 0) >= maxPerRule || (counts.get(to) ?? 0) >= maxPerRule) continue;
		counts.set(from, (counts.get(from) ?? 0) + 1);
		counts.set(to, (counts.get(to) ?? 0) + 1);
		kept.push(scored);
	}
	return kept;
}
