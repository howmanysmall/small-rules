#!/usr/bin/env bun

import { mkdirSync, writeFileSync } from "node:fs";
import nodePath from "node:path";
import { performance } from "node:perf_hooks";
import { argv } from "node:process";
import { OpenRouter } from "@openrouter/sdk";
import { consola } from "consola";

import { relationDenylist, relationPins } from "$documentation/data/rule-relations.overrides";
import { createBaseCommand } from "$script-functions/create-base-command";
import { getScriptName } from "$script-functions/get-script-name";
import { createJudgmentCache, createReasonCache } from "$script-utilities/rule-relations/cache";
import {
	decisionModel,
	reasonModel as defaultReasonModel,
	generatedRelationDocumentPath,
	judgmentBatchSize,
	judgmentPromptVersion,
	judgmentThresholds,
	maxRelationsPerRule,
	reasonPromptVersion,
	requestConcurrency,
	reviewReportPath,
} from "$script-utilities/rule-relations/constants";
import {
	createOpenRouterClientOptions,
	createOpenRouterDecisionTransport,
	createOpenRouterReasonWriter,
	createOpenRouterRequestOptions,
} from "$script-utilities/rule-relations/openrouter";
import { renderRelationDocument } from "$script-utilities/rule-relations/render";
import { repositoryRoot } from "$script-utilities/rule-relations/repository";
import { createRelationReviewReport } from "$script-utilities/rule-relations/review";
import { buildRuleCards } from "$script-utilities/rule-relations/rule-cards";
import { createAllRulePairs, readGeneratedEdges, regenerateRelationsAsync } from "$script-utilities/rule-relations/run";
import { compareStrings } from "$script-utilities/rule-relations/types";
import { createRelationUsageTracker, formatRelationRunSummary } from "$script-utilities/rule-relations/usage";
import { checkRelationsDocument } from "$script-utilities/rule-relations/validate";

import type { RelationProgress } from "$script-utilities/rule-relations/types";

const name = getScriptName(true);
const log = consola.withTag(name);
const cacheRoot = nodePath.join(repositoryRoot, ".cache/rule-relations");

const command = createBaseCommand(name, "1.0.0", 'Regenerates the documentation site\'s "related rules" data.')
	.env("OPENROUTER_API_KEY=<api-key:string>", "The OpenRouter API key.", { required: true })
	.option("--reason-model <reasonModel:string>", "The OpenRouter model used to write relation reasons.", {
		default: defaultReasonModel,
	})
	.option("--concurrency <concurrency:integer>", "The most OpenRouter requests in flight at once.", {
		default: requestConcurrency,
	})
	.option("--review-output <reviewOutput:string>", "Path to write the relation review report.", {
		default: reviewReportPath,
	})
	.option("--no-review", "Skip writing the relation review report.")
	.action(async ({ concurrency, openrouterApiKey, reasonModel, review, reviewOutput }): Promise<void> => {
		if (concurrency < 1) {
			throw new RangeError(`--concurrency must be at least 1, got ${concurrency}.`);
		}

		const startedAt = performance.now();
		const usageTracker = createRelationUsageTracker();
		const progress: Partial<Record<RelationProgress["phase"], RelationProgress>> = {};
		let activePhase: RelationProgress["phase"] | undefined;
		let lastProgressAt = 0;

		function reportProgress(update: RelationProgress): void {
			progress[update.phase] = update;
			const now = performance.now();
			const shouldLog =
				activePhase !== update.phase || update.completed === update.total || now - lastProgressAt >= 5_000;

			if (!shouldLog) return;

			activePhase = update.phase;
			lastProgressAt = now;
			log.info(
				`${update.phase}: ${update.completed.toLocaleString()}/${update.total.toLocaleString()} (${update.cached.toLocaleString()} cached)`,
			);
		}

		const openrouter = new OpenRouter(createOpenRouterClientOptions(openrouterApiKey));
		const requestOptions = createOpenRouterRequestOptions();
		const cards = buildRuleCards();
		const ruleNames = [...cards.keys()].toSorted(compareStrings);
		const pairs = createAllRulePairs(ruleNames);
		const existingEdges = readGeneratedEdges(generatedRelationDocumentPath);
		log.info(`judging ${pairs.length.toLocaleString()} rule pairs`);

		try {
			const result = await regenerateRelationsAsync({
				allNames: ruleNames,
				batchSize: judgmentBatchSize,
				cards,
				concurrency,
				decisionModel,
				existingEdges,
				judgmentCache: createJudgmentCache(nodePath.join(cacheRoot, "judgments")),
				judgmentPromptVersion,
				maxRelationsPerRule,
				onProgress: reportProgress,
				pairs,
				reasonCache: createReasonCache(nodePath.join(cacheRoot, "reasons")),
				reasonModel,
				reasonPromptVersion,
				reasonWriter: createOpenRouterReasonWriter(
					reasonModel,
					async (request) => {
						const response = await openrouter.chat.send(request, requestOptions);
						if (!("choices" in response)) {
							throw new TypeError("OpenRouter unexpectedly returned a stream.");
						}

						return response;
					},
					usageTracker.record,
				),
				thresholds: judgmentThresholds,
				transport: createOpenRouterDecisionTransport(async (request) => {
					return openrouter.alpha.decisions.create(request, requestOptions);
				}, usageTracker.record),
			});

			const problems = checkRelationsDocument({
				denylist: relationDenylist,
				edges: result.edges,
				maxRelationsPerRule,
				pins: relationPins,
			});

			if (problems.length > 0) {
				throw new Error(problems.join("\n"));
			}

			const report = createRelationReviewReport({
				denylist: relationDenylist,
				pins: relationPins,
				previous: existingEdges,
				result,
			});
			const { changesSincePreviousRun, modelJudgments, qualityEvaluation } = report;
			const outputDirectory = nodePath.dirname(nodePath.join(repositoryRoot, generatedRelationDocumentPath));
			mkdirSync(outputDirectory, { recursive: true });
			writeFileSync(
				nodePath.join(repositoryRoot, generatedRelationDocumentPath),
				renderRelationDocument({
					edges: result.edges,
					models: { decisions: decisionModel, reasons: reasonModel },
				}),
				"utf8",
			);

			log.success(`wrote ${result.edges.length} relations to ${generatedRelationDocumentPath}`);

			if (review) {
				const resolvedReviewReportPath = nodePath.resolve(repositoryRoot, reviewOutput);
				mkdirSync(nodePath.dirname(resolvedReviewReportPath), { recursive: true });
				writeFileSync(
					resolvedReviewReportPath,
					`${JSON.stringify({ ...report, judgmentPromptVersion, models: { decisions: decisionModel, reasons: reasonModel }, thresholds: judgmentThresholds }, undefined, "\t")}\n`,
					"utf8",
				);
				log.info(
					`wrote review report to ${reviewOutput} (${modelJudgments.needsReview.length} actionable, ${modelJudgments.omittedLowSignalReviewCount} low-signal omitted)`,
				);
			}

			log.info(
				`model verdicts: ${modelJudgments.acceptedCount} accepted, ${modelJudgments.rejectedCount} rejected, ${modelJudgments.needsReviewCount} need review; ${modelJudgments.capped.length} accepted links omitted by the cap`,
			);
			log.info(
				`manual checks: ${qualityEvaluation.matchedPairCount}/${qualityEvaluation.checkedPairCount} agree (${qualityEvaluation.positiveLabelCount} pins, ${qualityEvaluation.negativeLabelCount} denials)`,
			);

			for (const disagreement of qualityEvaluation.disagreements) {
				const actual =
					disagreement.actual.type === "relation"
						? `${disagreement.actual.relation.from} ${disagreement.actual.relation.kind} ${disagreement.actual.relation.to}`
						: disagreement.actual.type;

				log.warn(`override disagreement: ${disagreement.pair.from} ↔ ${disagreement.pair.to}; Jev: ${actual}`);
			}

			log.info(
				`changes since previous run: ${changesSincePreviousRun.unchangedRelationCount} unchanged, ${changesSincePreviousRun.added.length} added, ${changesSincePreviousRun.removed.length} removed, ${changesSincePreviousRun.changed.length} changed`,
			);
		} finally {
			const summary = formatRelationRunSummary({
				elapsedMilliseconds: performance.now() - startedAt,
				progress,
				usage: usageTracker.getTotals(),
			});

			for (const line of summary) {
				log.info(line);
			}
		}
	});

await command.parse(argv.slice(2));
