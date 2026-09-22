import { compareStrings } from "./types";

import type { RuleName } from "$data/rule-manifest";

import type { JudgmentThresholds, PairJudgments, RelationDraft, RelationResolution, ScoredRelation } from "./types";

interface DirectedCandidate {
	readonly relation: RelationDraft;
	readonly score: number;
}

interface ResolveOptions {
	readonly judgments: PairJudgments;
	readonly left: RuleName;
	readonly right: RuleName;
	readonly thresholds: JudgmentThresholds;
}

export function resolvePairRelation({ judgments, left, right, thresholds }: ResolveOptions): RelationResolution {
	if (judgments.assessment.probabilities["0"] >= thresholds.accept) return { type: "none" };
	const strength = judgments.assessment.probabilities["2"];
	if (strength < thresholds.accept) {
		return { concern: "relationship needs review", strength, type: "review" };
	}

	const directedCandidates = [
		{ relation: { from: left, kind: "supersedes", to: right }, score: judgments.forwardReplaces },
		{ relation: { from: right, kind: "supersedes", to: left }, score: judgments.backwardReplaces },
		{ relation: { from: left, kind: "depends-on", to: right }, score: judgments.forwardRequires },
		{ relation: { from: right, kind: "depends-on", to: left }, score: judgments.backwardRequires },
	] satisfies ReadonlyArray<DirectedCandidate>;

	const accepted = directedCandidates.filter((candidate) => candidate.score >= thresholds.accept);
	if (accepted.length > 1) {
		return { concern: "conflicting directed judgments", strength, type: "review" };
	}

	const [directed] = accepted;
	if (directed !== undefined) {
		return { relation: directed.relation, strength, type: "relation" };
	}

	if (directedCandidates.some((candidate) => candidate.score >= thresholds.review)) {
		return { concern: "uncertain relation kind or direction", strength, type: "review" };
	}

	if (judgments.duplicates >= thresholds.accept) {
		return { relation: { from: left, kind: "overlaps", to: right }, strength, type: "relation" };
	}

	if (judgments.duplicates >= thresholds.review) {
		return { concern: "uncertain diagnostic overlap", strength, type: "review" };
	}

	return { relation: { from: left, kind: "related", to: right }, strength, type: "relation" };
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
	let size = 0;
	for (const scored of ordered) {
		const { from, to } = scored.relation;
		if ((counts.get(from) ?? 0) >= maxPerRule || (counts.get(to) ?? 0) >= maxPerRule) continue;

		counts.set(from, (counts.get(from) ?? 0) + 1);
		counts.set(to, (counts.get(to) ?? 0) + 1);
		kept[size++] = scored;
	}

	return kept;
}
