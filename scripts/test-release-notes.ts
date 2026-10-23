#!/usr/bin/env bun

import { readFile } from "node:fs/promises";
import process, { argv } from "node:process";
import { EnumType } from "@cliffy/command";
import { isMaybeBoolean, isMaybeInteger, isMaybeString, isUndefined } from "@small-rules/arktype-utilities";
import { existsAsync } from "@small-rules/fs-utilities";
import { bold, cyan, dim, green } from "ansis";
import { regex, type } from "arktype";
import { consola } from "consola";
import { exec } from "tinyexec";

import { createBaseCommand } from "$script-functions/create-base-command";
import { getScriptName } from "$script-functions/get-script-name";

import type { OpenRouter } from "@openrouter/sdk";
import type { PricingOverride, PublicPricing, UtcDay } from "@openrouter/sdk/models";

const scriptName = getScriptName(true);
const log = consola.withTag(scriptName);
let openrouter: OpenRouter | undefined;

const TOML_FILE = "communique.toml";

enum Release {
	Maintenance = "maintenance",
	Major = "major",
	Minor = "minor",
	MinorLarge = "minor-large",
	Patch = "patch",
}

async function getNextFileNameAsync(release: Release): Promise<string> {
	let version = 1;

	while (true) {
		const fileName = `haiku-${release}-v${version}.md`;

		// oxlint-disable-next-line no-await-in-loop -- sequential.
		const exists = await existsAsync(fileName);
		if (!exists) return fileName;
		version += 1;
	}
}

// oxlint-disable-next-line unicorn/prefer-string-raw -- no lol
const TOKENS_REGEXP = regex("Tokens: (?<input>\\d+) input \\+ (?<output>\\d+)", "u");

const isCommuniqueDefaults = type({
	"+": "reject",
	"base_url?": isMaybeString,
	"emoji?": isMaybeBoolean,
	"match_style?": isMaybeBoolean,
	"max_tokens?": isMaybeInteger,
	"model?": isMaybeString,
	"provider?": isMaybeString,
	"repo?": isMaybeString,
	"verify_links?": isMaybeBoolean,
}).readonly();

const isCommuniqueConfiguration = type({
	"+": "reject",
	"context?": isMaybeString,
	"defaults?": isCommuniqueDefaults.or(isUndefined),
	"system_extra?": isMaybeString,
}).readonly();

type CommuniqueConfiguration = typeof isCommuniqueConfiguration.infer;

async function getCommuniqueAsync(): Promise<CommuniqueConfiguration> {
	const contents = await readFile(TOML_FILE, "utf8");
	return isCommuniqueConfiguration.assert(Bun.TOML.parse(contents));
}

interface Cost {
	readonly input: number;
	readonly output: number;
	readonly total: number;
}

interface TokenRates {
	readonly completion: number;
	readonly prompt: number;
}

const UTC_WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
const TOKEN_REGEXP = /^-?\d+(?:\.\d+)?$/u;

function getUsdPerToken(price: string): number {
	if (!TOKEN_REGEXP.test(price)) {
		throw new Error(`Invalid token price: ${price}`);
	}

	return Number(price);
}

function requireTokenCount(tokens: number, label: string): number {
	if (!Number.isSafeInteger(tokens) || tokens < 0) {
		throw new Error(`${label} token count must be a non-negative integer`);
	}

	return tokens;
}

function getUtcWeekday(at: Date): UtcDay {
	const day = UTC_WEEKDAYS[at.getUTCDay()];
	if (day === undefined) {
		throw new Error(`Invalid UTC weekday: ${at.getUTCDay()}`);
	}

	return day;
}

function getUtcClock(at: Date): number {
	return at.getUTCHours() * 100 + at.getUTCMinutes();
}

function isClockInsideWindow(clock: number, start: number, end: number): boolean {
	if (start === end) return false;
	if (start < end) return clock >= start && clock < end;
	return clock >= start || clock < end;
}

function doesOverrideApply(
	{ minPromptTokens, utcDays, utcEnd, utcStart }: PricingOverride,
	inputTokens: number,
	at: Date,
): boolean {
	if (minPromptTokens !== undefined && inputTokens <= minPromptTokens) return false;
	if (utcDays !== undefined && !utcDays.includes(getUtcWeekday(at))) return false;
	if (utcStart === undefined && utcEnd === undefined) return true;

	// A missing edge is the corresponding edge of the UTC day.
	return isClockInsideWindow(getUtcClock(at), utcStart ?? 0, utcEnd ?? 2400);
}

function getEffectiveRates(publicPricing: PublicPricing, inputTokens: number, at: Date): TokenRates {
	let completion = getUsdPerToken(publicPricing.completion);
	let prompt = getUsdPerToken(publicPricing.prompt);

	if (publicPricing.overrides !== undefined) {
		for (const override of publicPricing.overrides) {
			if (!doesOverrideApply(override, inputTokens, at)) continue;

			if (override.completion !== undefined) {
				completion = getUsdPerToken(override.completion);
			}

			if (override.prompt !== undefined) {
				prompt = getUsdPerToken(override.prompt);
			}
		}
	}

	return { completion, prompt };
}

function getCostForTokens(
	publicPricing: PublicPricing,
	inputTokens: number,
	outputTokens: number,
	at = new Date(),
): Cost {
	const inputCount = requireTokenCount(inputTokens, "Input");
	const outputCount = requireTokenCount(outputTokens, "Output");
	const rates = getEffectiveRates(publicPricing, inputCount, at);
	const factor = publicPricing.discount === undefined ? 1 : 1 - publicPricing.discount;
	const input = inputCount * rates.prompt * factor;
	const output = outputCount * rates.completion * factor;

	return { input, output, total: input + output };
}

async function getCostAsync(inputTokens: number, outputTokens: number): Promise<Cost> {
	if (!openrouter) {
		throw new Error("OpenRouter is not initialized somehow?");
	}

	const communique = await getCommuniqueAsync();
	const model = communique.defaults?.model;
	if (model === undefined) {
		throw new Error("No model specified in communique.toml");
	}

	const slash = model.indexOf("/");
	if (slash <= 0 || slash === model.length - 1) {
		throw new Error(`Invalid model format: ${model}`);
	}

	const { data } = await openrouter.models.get({
		author: model.slice(0, slash),
		slug: model.slice(slash + 1),
	});

	return getCostForTokens(data.pricing, inputTokens, outputTokens);
}

const TOKEN_COUNTS = new Intl.NumberFormat("en-US");

function formatUsd(amount: number): string {
	return `$${amount.toFixed(6)}`;
}

function renderCostReport(inputTokens: number, outputTokens: number, cost: Cost): string {
	const inputTokensText = `${TOKEN_COUNTS.format(inputTokens)} tokens`;
	const outputTokensText = `${TOKEN_COUNTS.format(outputTokens)} tokens`;
	const tokensWidth = Math.max(inputTokensText.length, outputTokensText.length);

	const inputCostText = formatUsd(cost.input);
	const outputCostText = formatUsd(cost.output);
	const totalCostText = formatUsd(cost.total);
	const costWidth = Math.max(inputCostText.length, outputCostText.length, totalCostText.length);

	return [
		`${dim("Input".padEnd(6))}  ${cyan(inputTokensText.padStart(tokensWidth))}  ${green(inputCostText.padStart(costWidth))}`,
		`${dim("Output")}  ${cyan(outputTokensText.padStart(tokensWidth))}  ${green(outputCostText.padStart(costWidth))}`,
		`${bold("Total".padEnd(6))}  ${" ".repeat(tokensWidth)}  ${bold(green(totalCostText.padStart(costWidth)))}`,
	].join("\n");
}

async function writePrettyOutputAsync(output: string, outputFile: string): Promise<void> {
	if (!openrouter) {
		throw new Error("OpenRouter is not initialized somehow?");
	}

	const groups = TOKENS_REGEXP.exec(output)?.groups;
	if (!groups) {
		log.fail("No token counts found in communique output.");

		if (output.trim().length > 0) {
			log.log(output.trim());
		}

		return;
	}

	const inputTokens = Number(groups.input);
	const outputTokens = Number(groups.output);
	const cost = await getCostAsync(inputTokens, outputTokens);
	log.box(renderCostReport(inputTokens, outputTokens, cost));
	log.success(`Dry run complete: ${outputFile} (total ${formatUsd(cost.total)})`);
}

function getArgumentsForRelease(release: Release): readonly [string, string] {
	switch (release) {
		case Release.Maintenance:
			return ["v3.2.0", "v3.1.0"];

		case Release.Major:
			return ["v3.0.0", "v2.19.1"];

		case Release.Minor:
			return ["v3.4.0", "v3.3.3"];

		case Release.MinorLarge:
			return ["v3.3.0", "v3.2.0"];

		case Release.Patch:
			return ["v3.3.3", "v3.3.2"];

		default:
			throw new Error(`Unknown release type: ${String(release satisfies never)}`);
	}
}

async function getExecutionAsync(nextFileName: string, release: Release): Promise<[string, ReadonlyArray<string>]> {
	const exists = await existsAsync("communique-fixed");
	if (exists) {
		return [
			"./communique-fixed",
			[
				"generate",
				"--dry-run",
				"--config",
				TOML_FILE,
				"--output",
				nextFileName,
				...getArgumentsForRelease(release),
			],
		];
	}

	return [
		"mise",
		[
			"x",
			"--",
			"communique",
			"generate",
			"--dry-run",
			"--config",
			TOML_FILE,
			"--output",
			nextFileName,
			...getArgumentsForRelease(release),
		],
	];
}

const command = createBaseCommand(scriptName, "1.1.0", "Test release notes script")
	.type(
		"release-type",
		new EnumType([Release.Maintenance, Release.Major, Release.Minor, Release.MinorLarge, Release.Patch] as const),
	)
	.env("OPENROUTER_API_KEY=<value:string>", "The OpenRouter API key to use for the request.")
	.option("--release <value:release-type>", "The type of release to generate notes for.", { default: Release.Minor })
	.action(async ({ openrouterApiKey, release }) => {
		const { OpenRouter } = await import("@openrouter/sdk");
		openrouter = new OpenRouter({
			apiKey: openrouterApiKey,
		});

		const nextFileName = await getNextFileNameAsync(release);
		const [name, parameters] = await getExecutionAsync(nextFileName, release);
		log.start(`Dry-run release notes → ${nextFileName}`);

		const result = exec(name, parameters, {
			nodeOptions: {
				env: { OPENAI_API_KEY: openrouterApiKey },
				shell: true,
			},
		});

		let output = "";
		for await (const line of result) {
			const trueLine = `${line}\n`;
			output += trueLine;

			if (!TOKENS_REGEXP.test(line)) {
				process.stderr.write(trueLine);
			}
		}

		await writePrettyOutputAsync(output, nextFileName);
	});

await command.parse(argv.slice(2));
