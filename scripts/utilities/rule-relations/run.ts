import { isReadonlyArrayOfUnknowns } from "@small-rules/arktype-utilities";
import { compareWithLocale } from "@small-rules/string-utilities/compare-with-locale";
import { type } from "arktype";
import { Effect } from "effect";

import { createCacheKey } from "./cache";
import { maxReasonAttempts } from "./constants";
import { createPairJudgmentQuestions, interpretJudgmentAnswers } from "./questions";
import { validateReason } from "./reasons";
import { isGeneratedEdge } from "./render";
import { readRepositoryFile } from "./repository";
import { applyRelationCap, resolvePairRelation } from "./resolve";
import { getPairKey } from "./types";

import type { RuleName } from "$documentation/data/rule-manifest";

import type { JudgmentCache, ReasonCache } from "./cache";
import type { GeneratedEdge, RelationEvidence } from "./render";
import type {
	DecisionTransport,
	JudgmentThresholds,
	PairJudgments,
	ReasonAttempt,
	ReasonWriter,
	RelationDraft,
	RelationProgress,
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

type OnProgress = (progress: RelationProgress) => void;

interface RegenerateOptions {
	readonly allNames: ReadonlyArray<string>;
	readonly batchSize: number;
	readonly cards: ReadonlyMap<RuleName, RuleCard>;
	readonly concurrency: number;
	readonly decisionModel: string;
	readonly existingEdges: ReadonlyArray<GeneratedEdge>;
	readonly judgmentCache: JudgmentCache | undefined;
	readonly judgmentPromptVersion: number;
	readonly maxReasonAttempts?: number | undefined;
	readonly maxRelationsPerRule: number;
	readonly onProgress?: OnProgress | undefined;
	readonly pairs: ReadonlyArray<UnorderedRulePair>;
	readonly reasonCache: ReasonCache | undefined;
	readonly reasonModel: string;
	readonly reasonPromptVersion: number;
	readonly reasonWriter: ReasonWriter;
	readonly thresholds: JudgmentThresholds;
	readonly transport: DecisionTransport;
}

export interface RegenerationResult {
	readonly edges: ReadonlyArray<GeneratedEdge>;
	readonly judgments: ReadonlyMap<string, PairJudgments>;
	readonly resolutions: ReadonlyMap<string, RelationResolution>;
	readonly reviews: ReadonlyArray<ReviewFinding>;
}

const isRelationDocumentInput = type({
	"+": "delete",
	edges: isReadonlyArrayOfUnknowns,
}).readonly();

interface ResolutionResult {
	readonly resolutions: ReadonlyMap<string, RelationResolution>;
	readonly reviews: ReadonlyArray<ReviewFinding>;
}

interface ReasonOutcome {
	readonly cached: boolean;
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
	let length = 0;
	for (let index = 0; index < values.length; index += size) {
		chunks[length++] = values.slice(index, index + size);
	}

	return chunks;
}

/**
 * Runs at most `concurrency` calls at once. Each call is uninterruptible, so
 * after one rejects, the calls already in flight finish (and cache what they
 * paid for) before the run rejects with that first error. No new call starts.
 *
 * @template TValue - The input type.
 * @template TResult - The result type.
 * @param values - The inputs, one call each.
 * @param concurrency - The most calls in flight at once.
 * @param mapAsync - The call to make for each input.
 * @returns The results in input order.
 */
async function mapWithConcurrencyAsync<TValue, TResult>(
	values: ReadonlyArray<TValue>,
	concurrency: number,
	mapAsync: (value: TValue) => Promise<TResult>,
): Promise<ReadonlyArray<TResult>> {
	return Effect.runPromise(
		Effect.forEach(values, (value) => Effect.uninterruptible(Effect.promise(async () => mapAsync(value))), {
			concurrency,
		}),
	);
}

interface JudgmentCacheKeyOptions {
	readonly candidate: RuleCard;
	readonly decisionModel: string;
	readonly promptVersion: number;
	readonly source: RuleCard;
}

function getJudgmentCacheKey(options: JudgmentCacheKeyOptions): string {
	return createCacheKey(options);
}

function getRuleCard(cards: ReadonlyMap<RuleName, RuleCard>, name: RuleName): RuleCard {
	const card = cards.get(name);
	if (card === undefined) {
		throw new Error(`Missing rule card for "${name}".`);
	}

	return card;
}

function orderPair(pair: UnorderedRulePair): UnorderedRulePair {
	return pair.left < pair.right ? pair : { left: pair.right, right: pair.left };
}

export function createAllRulePairs(names: ReadonlyArray<RuleName>): ReadonlyArray<UnorderedRulePair> {
	const ordered = [...new Set(names)].toSorted(compareWithLocale);

	const pairs = new Array<UnorderedRulePair>();
	let length = 0;
	for (let leftIndex = 0; leftIndex < ordered.length; leftIndex += 1) {
		const left = ordered[leftIndex];
		if (left === undefined) continue;

		for (let rightIndex = leftIndex + 1; rightIndex < ordered.length; rightIndex += 1) {
			const right = ordered[rightIndex];
			if (right !== undefined) {
				pairs[length++] = { left, right };
			}
		}
	}

	return pairs;
}

interface JudgeOptions {
	readonly batchSize: number;
	readonly cache: JudgmentCache | undefined;
	readonly cards: ReadonlyMap<RuleName, RuleCard>;
	readonly concurrency: number;
	readonly decisionModel: string;
	readonly onProgress?: OnProgress | undefined;
	readonly pairs: ReadonlyArray<UnorderedRulePair>;
	readonly promptVersion: number;
	readonly transport: DecisionTransport;
}

export async function judgeRulePairsAsync(options: JudgeOptions): Promise<ReadonlyMap<string, PairJudgments>> {
	const judgments = new Map<string, PairJudgments>();
	const pendingBySource = new Map<RuleName, Array<RuleCard>>();
	const seenPairs = new Set<string>();
	let cachedCount = 0;
	let completed = 0;

	function registerPair(source: RuleName, candidateName: RuleName): void {
		const judgmentKey = getPairKey(source, candidateName);
		if (seenPairs.has(judgmentKey)) return;

		seenPairs.add(judgmentKey);

		const sourceCard = getRuleCard(options.cards, source);
		const candidate = getRuleCard(options.cards, candidateName);
		const cacheKey = getJudgmentCacheKey({
			candidate,
			decisionModel: options.decisionModel,
			promptVersion: options.promptVersion,
			source: sourceCard,
		});
		const cached = options.cache?.get(cacheKey);
		if (cached !== undefined) {
			judgments.set(judgmentKey, cached);
			completed += 1;
			cachedCount += 1;
			return;
		}

		const pending = pendingBySource.get(source);
		if (pending === undefined) {
			pendingBySource.set(source, [candidate]);
		} else {
			pending.push(candidate);
		}
	}

	for (const entry of options.pairs) {
		const pair = orderPair(entry);
		registerPair(pair.left, pair.right);
	}

	const total = seenPairs.size;
	options.onProgress?.({ cached: cachedCount, completed, phase: "judgments", total });

	const batches = [...pendingBySource].flatMap(([sourceName, candidates]) =>
		chunkValues(candidates, options.batchSize).map((candidatesChunk) => ({ candidatesChunk, sourceName })),
	);

	await mapWithConcurrencyAsync(
		batches,
		options.concurrency,
		async ({ candidatesChunk, sourceName }): Promise<void> => {
			const source = getRuleCard(options.cards, sourceName);
			const answers = await options.transport.decide({
				model: options.decisionModel,
				questions: createPairJudgmentQuestions(candidatesChunk),
				state: source,
			});

			const interpreted = interpretJudgmentAnswers(answers, candidatesChunk);
			for (const [candidateName, pairJudgments] of interpreted) {
				const candidate = getRuleCard(options.cards, candidateName);
				judgments.set(getPairKey(sourceName, candidateName), pairJudgments);
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

			completed += interpreted.size;
			options.onProgress?.({ cached: cachedCount, completed, phase: "judgments", total });
		},
	);

	return judgments;
}

interface ResolveOptions {
	readonly judgments: ReadonlyMap<string, PairJudgments>;
	readonly pairs: ReadonlyArray<UnorderedRulePair>;
	readonly thresholds: JudgmentThresholds;
}

export function resolveJudgedPairs(options: ResolveOptions): ResolutionResult {
	const resolutions = new Map<string, RelationResolution>();
	const reviews = new Array<ReviewFinding>();

	for (const entry of options.pairs) {
		const pair = orderPair(entry);
		const judgments = options.judgments.get(getPairKey(pair.left, pair.right));
		if (judgments === undefined) {
			throw new Error(`Missing judgments for ${pair.left} ↔ ${pair.right}.`);
		}

		const resolution = resolvePairRelation({
			judgments,
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

interface WriteOptions {
	readonly allNames: ReadonlyArray<string>;
	readonly cache: ReasonCache | undefined;
	readonly left: RuleCard;
	readonly maxAttempts: number;
	readonly model: string;
	readonly promptVersion: number;
	readonly relation: RelationDraft;
	readonly right: RuleCard;
	readonly writer: ReasonWriter;
}

interface WrittenReason extends ReasonAttempt {
	readonly cached: boolean;
}

function checkReason(options: WriteOptions, reason: string): ReasonAttempt {
	return {
		problems: validateReason({ allNames: options.allNames, reason, relation: options.relation }),
		reason,
	};
}

/**
 * Asks the writer for a sentence, feeding each rejected one back, until one
 * passes validation or the attempts run out.
 *
 * @param options - The relation, the writer to ask, and the attempt limit.
 * @returns The last attempt and its problems.
 */
async function attemptReasonAsync(options: WriteOptions): Promise<ReasonAttempt> {
	const { left, relation, right, writer } = options;
	let attempt = checkReason(options, await writer.writeReason({ left, relation, right }));
	for (let count = 1; count < options.maxAttempts && attempt.problems.length > 0; count += 1) {
		// Sequential on purpose: each retry corrects the attempt before it.
		const reason = await writer.writeReason({ left, previous: attempt, relation, right });
		attempt = checkReason(options, reason);
	}

	return attempt;
}

async function writeRelationReasonAsync(options: WriteOptions): Promise<WrittenReason> {
	const cacheKey = createCacheKey({
		left: options.left,
		model: options.model,
		promptVersion: options.promptVersion,
		relation: options.relation,
		right: options.right,
	});

	// A cached sentence that fails validation (cached before rejected
	// sentences stopped being stored) is ignored and rewritten.
	const cached = options.cache?.get(cacheKey);
	if (cached !== undefined) {
		const checked = checkReason(options, cached);
		if (checked.problems.length === 0) {
			return { ...checked, cached: true };
		}
	}

	const attempt = await attemptReasonAsync(options);
	if (attempt.problems.length === 0) {
		options.cache?.set(cacheKey, attempt.reason);
	}

	return { ...attempt, cached: false };
}

async function createReasonOutcomeAsync(fresh: FreshRelation, options: RegenerateOptions): Promise<ReasonOutcome> {
	const left = options.cards.get(fresh.relation.from);
	const right = options.cards.get(fresh.relation.to);
	if (left === undefined || right === undefined) {
		throw new Error(`Missing rule card for ${fresh.relation.from} ↔ ${fresh.relation.to}.`);
	}

	const written = await writeRelationReasonAsync({
		allNames: options.allNames,
		cache: options.reasonCache,
		left,
		maxAttempts: options.maxReasonAttempts ?? maxReasonAttempts,
		model: options.reasonModel,
		promptVersion: options.reasonPromptVersion,
		relation: fresh.relation,
		right,
		writer: options.reasonWriter,
	});

	return {
		cached: written.cached,
		fresh,
		problems: written.problems,
		reason: written.reason,
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
			if (fresh !== undefined) {
				freshRelations.push(fresh);
			}
		} else {
			edges.push(retained);
		}
	}

	return { edges, freshRelations };
}

export async function regenerateRelationsAsync(options: RegenerateOptions): Promise<RegenerationResult> {
	const judgments = await judgeRulePairsAsync({
		batchSize: options.batchSize,
		cache: options.judgmentCache,
		cards: options.cards,
		concurrency: options.concurrency,
		decisionModel: options.decisionModel,
		onProgress: options.onProgress,
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

		const pair = orderPair({ left: resolution.relation.from, right: resolution.relation.to });
		const pairJudgments = judgments.get(getPairKey(pair.left, pair.right));
		if (pairJudgments === undefined) {
			throw new Error(`Missing judgments for ${resolution.relation.from} ↔ ${resolution.relation.to}.`);
		}

		const fresh = {
			evidence: { judgments: pairJudgments, left: pair.left, right: pair.right, strength: resolution.strength },
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
	let cachedReasons = 0;
	let completedReasons = 0;
	const totalReasons = freshRelations.length;
	options.onProgress?.({ cached: cachedReasons, completed: completedReasons, phase: "reasons", total: totalReasons });

	const outcomes = await mapWithConcurrencyAsync(
		freshRelations,
		options.concurrency,
		async (fresh): Promise<ReasonOutcome> => {
			const outcome = await createReasonOutcomeAsync(fresh, options);
			completedReasons += 1;

			if (outcome.cached) {
				cachedReasons += 1;
			}

			options.onProgress?.({
				cached: cachedReasons,
				completed: completedReasons,
				phase: "reasons",
				total: totalReasons,
			});
			return outcome;
		},
	);

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

	return { edges, judgments, resolutions: resolved.resolutions, reviews };
}

export function readGeneratedEdges(relativePath: string): ReadonlyArray<GeneratedEdge> {
	const sourceText = readRepositoryFile(relativePath);
	if (sourceText.length === 0) {
		throw new Error(`Missing relation document "${relativePath}".`);
	}

	const parsed = JSON.parse(sourceText);
	const document = isRelationDocumentInput(parsed);
	if (document instanceof type.errors) {
		throw new TypeError(`Relation document "${relativePath}" has no edge list.`);
	}

	const edges = new Array<GeneratedEdge>();
	for (const value of document.edges) {
		const result = isGeneratedEdge(value);
		if (result instanceof type.errors) {
			throw new TypeError(`Invalid relation edge in "${relativePath}" - ${result.summary}`);
		}

		edges.push(result);
	}

	return edges;
}
