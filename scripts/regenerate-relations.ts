#!/usr/bin/env bun

import { mkdirSync, writeFileSync } from "node:fs";
import nodePath from "node:path";
import { argv } from "node:process";
import { OpenRouter } from "@openrouter/sdk";
import { consola } from "consola";

import { relationDenylist, relationPins } from "$data/rule-relations.overrides";
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
} from "$script-utilities/rule-relations/constants";
import { evalNegativePairs, evaluatePairs } from "$script-utilities/rule-relations/eval-fixture";
import {
	createOpenRouterDecisionTransport,
	createOpenRouterReasonWriter,
} from "$script-utilities/rule-relations/openrouter";
import { renderRelationDocument } from "$script-utilities/rule-relations/render";
import { repositoryRoot } from "$script-utilities/rule-relations/repository";
import { buildRuleCards } from "$script-utilities/rule-relations/rule-cards";
import { createAllRulePairs, readGeneratedEdges, regenerateRelationsAsync } from "$script-utilities/rule-relations/run";
import { compareStrings } from "$script-utilities/rule-relations/types";
import { checkRelationsDocument } from "$script-utilities/rule-relations/validate";

const name = getScriptName(true);
const log = consola.withTag(name);
const reviewReportPath = "documentation/src/data/generated/rule-relations.review.json";
const cacheRoot = nodePath.join(repositoryRoot, ".cache/rule-relations");

const command = createBaseCommand(name, "1.0.0", 'Regenerates the documentation site\'s "related rules" data.')
	.env("OPENROUTER_API_KEY=<api-key:string>", "The OpenRouter API key.", { required: true })
	.option("--reason-model <reasonModel:string>", "The OpenRouter model used to write relation reasons.", {
		default: defaultReasonModel,
	})
	.action(async ({ openrouterApiKey, reasonModel }): Promise<void> => {
		const openrouter = new OpenRouter({ apiKey: openrouterApiKey });
		const cards = buildRuleCards();
		const ruleNames = [...cards.keys()].toSorted(compareStrings);
		const pairs = createAllRulePairs(ruleNames);
		const existingEdges = readGeneratedEdges(generatedRelationDocumentPath);
		log.info(`judging ${pairs.length.toLocaleString()} rule pairs`);

		const result = await regenerateRelationsAsync({
			allNames: ruleNames,
			batchSize: judgmentBatchSize,
			cards,
			decisionModel,
			existingEdges,
			judgmentCache: createJudgmentCache(nodePath.join(cacheRoot, "judgments")),
			judgmentPromptVersion,
			maxRelationsPerRule,
			pairs,
			reasonCache: createReasonCache(nodePath.join(cacheRoot, "reasons")),
			reasonModel,
			reasonPromptVersion,
			reasonWriter: createOpenRouterReasonWriter(reasonModel, async (request) => {
				return openrouter.chat.send(request);
			}),
			thresholds: judgmentThresholds,
			transport: createOpenRouterDecisionTransport(async (request) => {
				return openrouter.alpha.decisions.create(request);
			}),
		});

		const problems = checkRelationsDocument({
			denylist: relationDenylist,
			edges: result.edges,
			maxRelationsPerRule,
			pins: relationPins,
		});
		if (problems.length > 0) throw new Error(problems.join("\n"));

		const evaluation = evaluatePairs({
			expectedNegatives: evalNegativePairs,
			expectedPositives: existingEdges.map((edge) => ({
				kind: edge.kind,
				pair: { left: edge.from, right: edge.to },
			})),
			resolutions: result.resolutions,
		});
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
		writeFileSync(
			nodePath.join(repositoryRoot, reviewReportPath),
			`${JSON.stringify({ evaluation, reviews: result.reviews }, undefined, "\t")}\n`,
			"utf8",
		);

		log.success(`wrote ${result.edges.length} relations and ${result.reviews.length} review findings`);
		log.info(`evaluation: ${JSON.stringify(evaluation)}`);
	});

await command.parse(argv.slice(2));
