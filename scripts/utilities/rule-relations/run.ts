import { type } from "arktype";

import { createCacheKey } from "./cache";
import { createPairJudgmentQuestions, interpretJudgmentAnswers } from "./questions";
import { validateReason } from "./reasons";
import { isGeneratedEdge } from "./render";
import { readRepositoryFile } from "./repository";
import { applyRelationCap, resolvePairRelation } from "./resolve";
import { getJudgmentKey, getPairKey } from "./types";

import type { RuleName } from "$data/rule-manifest";

import type { JudgmentCache, ReasonCache } from "./cache";
import type { GeneratedEdge, RelationEvidence } from "./render";
import type {
	DecisionTransport,
	JudgmentThresholds,
	PairJudgments,
	ReasonWriter,
	RelationDraft,
	RelationResolution,
	ReviewFinding,
	RuleCard,
	ScoredRelation,
	UnorderedRulePair,
} from "./types";

interface FreshRelation {
	readonly evidence: RelationEvidence;
	readonly relation: RelationDraft;
	readonly strength: number;
}

interface RegenerateOptions {
	readonly allNames: ReadonlyArray<string>;
	readonly batchSize: number;
	readonly cards: ReadonlyMap<RuleName, RuleCard>;
	readonly decisionModel: string;
	readonly existingEdges: ReadonlyArray<GeneratedEdge>;
	readonly judgmentCache: JudgmentCache | undefined;
	readonly judgmentPromptVersion: number;
	readonly maxRelationsPerRule: number;
	readonly pairs: ReadonlyArray<UnorderedRulePair>;
	readonly reasonCache: ReasonCache | undefined;
	readonly reasonModel: string;
	readonly reasonPromptVersion: number;
	readonly reasonWriter: ReasonWriter;
	readonly thresholds: JudgmentThresholds;
	readonly transport: DecisionTransport;
}

interface RegenerationResult {
	readonly edges: ReadonlyArray<GeneratedEdge>;
	readonly resolutions: ReadonlyMap<string, RelationResolution>;
	readonly reviews: ReadonlyArray<ReviewFinding>;
}

const isRelationDocumentInput = type({ edges: "unknown[]" });

interface ResolutionResult {
	readonly resolutions: ReadonlyMap<string, RelationResolution>;
	readonly reviews: ReadonlyArray<ReviewFinding>;
}

interface ReasonOutcome {
	readonly fresh: FreshRelation;
	readonly problems: ReadonlyArray<string>;
	readonly reason: string;
}

interface CappedRelations {
	readonly edges: Array<GeneratedEdge>;
	readonly freshRelations: Array<FreshRelation>;
}

function chunkValues<TValue>(values: ReadonlyArray<TValue>, size: number): ReadonlyArray<ReadonlyArray<TValue>> {
	const chunks = new Array<ReadonlyArray<TValue>>();
	for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size));
	return chunks;
}

function getJudgmentCacheKey(options: {
	readonly candidate: RuleCard;
	readonly decisionModel: string;
	readonly promptVersion: number;
	readonly source: RuleCard;
}): string {
	return createCacheKey(options);
}

export function createAllRulePairs(names: ReadonlyArray<RuleName>): ReadonlyArray<UnorderedRulePair> {
	const pairs = new Array<UnorderedRulePair>();
	for (let leftIndex = 0; leftIndex < names.length; leftIndex += 1) {
		const left = names[leftIndex];
		if (left === undefined) continue;
		for (let rightIndex = leftIndex + 1; rightIndex < names.length; rightIndex += 1) {
			const right = names[rightIndex];
			if (right !== undefined) pairs.push({ left, right });
		}
	}
	return pairs;
}

export async function judgeRulePairsAsync(options: {
	readonly batchSize: number;
	readonly cache: JudgmentCache | undefined;
	readonly cards: ReadonlyMap<RuleName, RuleCard>;
	readonly decisionModel: string;
	readonly pairs: ReadonlyArray<UnorderedRulePair>;
	readonly promptVersion: number;
	readonly transport: DecisionTransport;
}): Promise<ReadonlyMap<string, PairJudgments>> {
	const judgments = new Map<string, PairJudgments>();
	const pendingBySource = new Map<RuleName, Array<RuleCard>>();
	const seenDirections = new Set<string>();

	function registerDirection(source: RuleName, candidateName: RuleName): void {
		const judgmentKey = getJudgmentKey(source, candidateName);
		if (seenDirections.has(judgmentKey)) return;
		seenDirections.add(judgmentKey);

		const sourceCard = options.cards.get(source);
		if (sourceCard === undefined) throw new Error(`Missing rule card for "${source}".`);
		const candidate = options.cards.get(candidateName);
		if (candidate === undefined) throw new Error(`Missing rule card for "${candidateName}".`);

		const cacheKey = getJudgmentCacheKey({
			candidate,
			decisionModel: options.decisionModel,
			promptVersion: options.promptVersion,
			source: sourceCard,
		});
		const cached = options.cache?.get(cacheKey);
		if (cached !== undefined) {
			judgments.set(judgmentKey, cached);
			return;
		}

		const pending = pendingBySource.get(source);
		if (pending === undefined) pendingBySource.set(source, [candidate]);
		else pending.push(candidate);
	}

	for (const pair of options.pairs) {
		registerDirection(pair.left, pair.right);
		registerDirection(pair.right, pair.left);
	}

	const requests = [...pendingBySource].flatMap(([sourceName, candidates]) =>
		chunkValues(candidates, options.batchSize).map(async (candidatesChunk) => {
			const source = options.cards.get(sourceName);
			if (source === undefined) throw new Error(`Missing rule card for "${sourceName}".`);
			const answers = await options.transport.decide({
				model: options.decisionModel,
				questions: createPairJudgmentQuestions(candidatesChunk),
				state: source,
			});
			const interpreted = interpretJudgmentAnswers(answers, candidatesChunk);
			for (const [candidateName, pairJudgments] of interpreted) {
				const candidate = options.cards.get(candidateName);
				if (candidate === undefined) throw new Error(`Missing rule card for "${candidateName}".`);
				judgments.set(getJudgmentKey(sourceName, candidateName), pairJudgments);
				options.cache?.set(
					getJudgmentCacheKey({
						candidate,
						decisionModel: options.decisionModel,
						promptVersion: options.promptVersion,
						source,
					}),
					pairJudgments,
				);
			}
		}),
	);
	await Promise.all(requests);

	return judgments;
}

export function resolveJudgedPairs(options: {
	readonly judgments: ReadonlyMap<string, PairJudgments>;
	readonly pairs: ReadonlyArray<UnorderedRulePair>;
	readonly thresholds: JudgmentThresholds;
}): ResolutionResult {
	const resolutions = new Map<string, RelationResolution>();
	const reviews = new Array<ReviewFinding>();

	for (const pair of options.pairs) {
		const forward = options.judgments.get(getJudgmentKey(pair.left, pair.right));
		const backward = options.judgments.get(getJudgmentKey(pair.right, pair.left));
		if (forward === undefined || backward === undefined) {
			throw new Error(`Missing judgments for ${pair.left} ↔ ${pair.right}.`);
		}

		const resolution = resolvePairRelation({
			backward,
			forward,
			left: pair.left,
			right: pair.right,
			thresholds: options.thresholds,
		});
		resolutions.set(getPairKey(pair.left, pair.right), resolution);
		if (resolution.type === "review") {
			reviews.push({
				concern: resolution.concern,
				left: pair.left,
				right: pair.right,
				strength: resolution.strength,
			});
		}
	}

	return { resolutions, reviews };
}

async function writeRelationReasonAsync(options: {
	readonly cache: ReasonCache | undefined;
	readonly left: RuleCard;
	readonly model: string;
	readonly promptVersion: number;
	readonly relation: RelationDraft;
	readonly right: RuleCard;
	readonly writer: ReasonWriter;
}): Promise<string> {
	const cacheKey = createCacheKey({
		left: options.left,
		model: options.model,
		promptVersion: options.promptVersion,
		relation: options.relation,
		right: options.right,
	});
	const cached = options.cache?.get(cacheKey);
	if (cached !== undefined) return cached;

	const reason = await options.writer.writeReason({
		left: options.left,
		relation: options.relation,
		right: options.right,
	});
	options.cache?.set(cacheKey, reason);
	return reason;
}

async function createReasonOutcomeAsync(fresh: FreshRelation, options: RegenerateOptions): Promise<ReasonOutcome> {
	const left = options.cards.get(fresh.relation.from);
	const right = options.cards.get(fresh.relation.to);
	if (left === undefined || right === undefined) {
		throw new Error(`Missing rule card for ${fresh.relation.from} ↔ ${fresh.relation.to}.`);
	}

	const reason = await writeRelationReasonAsync({
		cache: options.reasonCache,
		left,
		model: options.reasonModel,
		promptVersion: options.reasonPromptVersion,
		relation: fresh.relation,
		right,
		writer: options.reasonWriter,
	});
	return {
		fresh,
		problems: validateReason({ allNames: options.allNames, reason, relation: fresh.relation }),
		reason,
	};
}

function selectCappedRelations(
	scored: ReadonlyArray<ScoredRelation>,
	maxRelationsPerRule: number,
	retainedByPair: ReadonlyMap<string, GeneratedEdge>,
	freshByPair: ReadonlyMap<string, FreshRelation>,
): CappedRelations {
	const edges = new Array<GeneratedEdge>();
	const freshRelations = new Array<FreshRelation>();
	for (const entry of applyRelationCap(scored, maxRelationsPerRule)) {
		const pairKey = getPairKey(entry.relation.from, entry.relation.to);
		const retained = retainedByPair.get(pairKey);
		if (retained === undefined) {
			const fresh = freshByPair.get(pairKey);
			if (fresh !== undefined) freshRelations.push(fresh);
		} else edges.push(retained);
	}
	return { edges, freshRelations };
}

export async function regenerateRelationsAsync(options: RegenerateOptions): Promise<RegenerationResult> {
	const judgments = await judgeRulePairsAsync({
		batchSize: options.batchSize,
		cache: options.judgmentCache,
		cards: options.cards,
		decisionModel: options.decisionModel,
		pairs: options.pairs,
		promptVersion: options.judgmentPromptVersion,
		transport: options.transport,
	});
	const resolved = resolveJudgedPairs({ judgments, pairs: options.pairs, thresholds: options.thresholds });
	const judgedPairKeys = new Set(options.pairs.map((pair) => getPairKey(pair.left, pair.right)));
	const retainedEdges = options.existingEdges.filter((edge) => !judgedPairKeys.has(getPairKey(edge.from, edge.to)));

	const freshByPair = new Map<string, FreshRelation>();
	const scored = new Array<ScoredRelation>();
	for (const resolution of resolved.resolutions.values()) {
		if (resolution.type !== "relation") continue;
		const forward = judgments.get(getJudgmentKey(resolution.relation.from, resolution.relation.to));
		const backward = judgments.get(getJudgmentKey(resolution.relation.to, resolution.relation.from));
		if (forward === undefined || backward === undefined) {
			throw new Error(`Missing judgments for ${resolution.relation.from} ↔ ${resolution.relation.to}.`);
		}

		const fresh = {
			evidence: { backward, forward, strength: resolution.strength },
			relation: resolution.relation,
			strength: resolution.strength,
		} satisfies FreshRelation;
		freshByPair.set(getPairKey(fresh.relation.from, fresh.relation.to), fresh);
		scored.push({ relation: fresh.relation, strength: fresh.strength });
	}

	const retainedByPair = new Map<string, GeneratedEdge>();
	for (const edge of retainedEdges) {
		const pairKey = getPairKey(edge.from, edge.to);
		retainedByPair.set(pairKey, edge);
		scored.push({
			relation: { from: edge.from, kind: edge.kind, to: edge.to },
			strength: edge.evidence?.strength ?? 0,
		});
	}

	const { edges, freshRelations } = selectCappedRelations(
		scored,
		options.maxRelationsPerRule,
		retainedByPair,
		freshByPair,
	);

	const reviews = [...resolved.reviews];
	const outcomes = await Promise.all(freshRelations.map(async (fresh) => createReasonOutcomeAsync(fresh, options)));

	for (const outcome of outcomes) {
		if (outcome.problems.length > 0) {
			reviews.push({
				concern: `reason rejected: ${outcome.problems.join(" ")}`,
				left: outcome.fresh.relation.from,
				right: outcome.fresh.relation.to,
				strength: outcome.fresh.strength,
			});
			continue;
		}

		edges.push({
			evidence: outcome.fresh.evidence,
			from: outcome.fresh.relation.from,
			kind: outcome.fresh.relation.kind,
			reason: outcome.reason,
			to: outcome.fresh.relation.to,
		});
	}

	return { edges, resolutions: resolved.resolutions, reviews };
}

export function readGeneratedEdges(relativePath: string): ReadonlyArray<GeneratedEdge> {
	const sourceText = readRepositoryFile(relativePath);
	if (sourceText === "") throw new Error(`Missing relation document "${relativePath}".`);

	const parsed: unknown = JSON.parse(sourceText);
	const document = isRelationDocumentInput(parsed);
	if (document instanceof type.errors) {
		throw new TypeError(`Relation document "${relativePath}" has no edge list.`);
	}

	const edges = new Array<GeneratedEdge>();
	for (const value of document.edges) {
		if (!isGeneratedEdge(value)) throw new TypeError(`Invalid relation edge in "${relativePath}".`);
		edges.push(value);
	}
	return edges;
}
