#!/usr/bin/env bun

import { readFile, stat } from "node:fs/promises";
import { exit } from "node:process";
import { stripVTControlCharacters as strip } from "node:util";
import { gzipSync } from "node:zlib";
import { bold, cyan, dim, green, red, yellow } from "ansis";
import prettyBytes from "pretty-bytes";
import prettyMilliseconds from "pretty-ms";
import { build } from "tsdown";

import { createBaseCommand } from "$script-functions/create-base-command";

import type { InlineConfig, Logger } from "tsdown";

interface Artifact {
	readonly label: string;
	readonly path: string;
}

interface Measurement {
	readonly gzipped: number;
	readonly size: number;
}

interface CapturedLogs {
	readonly errors: Array<string>;
	readonly successes: Array<string>;
	readonly warnings: Array<string>;
}

interface CapturingLogger {
	readonly logger: Logger;
	readonly logs: CapturedLogs;
}

const ARTIFACTS: ReadonlyArray<Artifact> = [
	{ label: "small-rules.js", path: "plugins/small-rules.js" },
	{ label: "index.d.ts", path: "dist/index.d.ts" },
];

const CHECK_NAMES: ReadonlyArray<string> = ["attw", "publint"];

const BYTES = new Intl.NumberFormat("en-US");
const PERCENT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

async function getSizeAsync(path: string): Promise<number | undefined> {
	try {
		const stats = await stat(path);
		return stats.size;
	} catch {
		return undefined;
	}
}

async function measureAsync(path: string): Promise<Measurement> {
	const bytes = await readFile(path);
	return { gzipped: gzipSync(bytes).byteLength, size: bytes.byteLength };
}

function formatDelta(current: number, previous?: number): string {
	if (previous === undefined) return dim("new");

	const delta = current - previous;
	if (delta === 0) return dim("± 0 B");

	const sign = delta > 0 ? "+" : "";
	const arrow = delta > 0 ? "▲" : "▼";
	const percent = previous === 0 ? "" : ` (${sign}${PERCENT.format((delta / previous) * 100)}%)`;
	const text = `${arrow} ${sign}${prettyBytes(delta)}${percent}`;
	return delta > 0 ? red(text) : green(text);
}

function stringify(values: ReadonlyArray<unknown>): string {
	return strip(values.map((value) => (value instanceof Error ? value.message : String(value))).join(" ")).trim();
}

function getVisibleWidth(text: string): number {
	return strip(text).length;
}

function getMaxWidth(texts: ReadonlyArray<string>): number {
	let width = 0;
	for (const text of texts) width = Math.max(width, getVisibleWidth(text));
	return width;
}

function padVisible(text: string, width: number): string {
	return `${text}${" ".repeat(Math.max(0, width - getVisibleWidth(text)))}`;
}

function createCapturingLogger(): CapturingLogger {
	const logs: CapturedLogs = { errors: [], successes: [], warnings: [] };
	function warn(...values: ReadonlyArray<unknown>): void {
		logs.warnings.push(stringify(values));
	}

	const logger: Logger = {
		clearScreen: () => undefined,
		error: (...values) => {
			logs.errors.push(stringify(values));
		},
		info: () => undefined,
		level: "info",
		// oxlint-disable-next-line small-rules/starts-with-verb -- tsdown's Logger interface.
		success: (...values) => {
			logs.successes.push(stringify(values));
		},
		warn,
		warnOnce: warn,
	};

	return { logger, logs };
}

function renderBox(lines: ReadonlyArray<string>, paint: (text: string) => string): string {
	const width = getMaxWidth(lines);
	const horizontal = "─".repeat(width + 2);
	const body = lines.map((line) => `${paint("│")} ${padVisible(line, width)} ${paint("│")}`);
	return [paint(`┌${horizontal}┐`), ...body, paint(`└${horizontal}┘`)].join("\n");
}

function describeChecks(successes: ReadonlyArray<string>): string {
	return CHECK_NAMES.map((name) => {
		const passed = successes.some((message) => message.includes(`[${name}]`));
		return `${passed ? green("✓") : yellow("?")} ${name}`;
	}).join("  ");
}

function renderArtifactLines(
	measurements: ReadonlyArray<Measurement>,
	previousSizes: ReadonlyArray<number | undefined>,
): Array<string> {
	const labels = ARTIFACTS.map(({ label }) => label);
	const sizes = measurements.map(({ size }) => prettyBytes(size));
	const deltas = measurements.map(({ size }, index) => formatDelta(size, previousSizes[index]));

	const labelWidth = getMaxWidth(labels);
	const sizeWidth = getMaxWidth(sizes);
	const deltaWidth = getMaxWidth(deltas);

	return measurements.flatMap(({ gzipped, size }, index) => {
		const previous = previousSizes[index];
		const was = previous === undefined || previous === size ? "" : `, was ${BYTES.format(previous)} bytes`;

		return [
			[
				cyan(padVisible(labels[index] ?? "", labelWidth)),
				bold.magenta(padVisible(sizes[index] ?? "", sizeWidth)),
				padVisible(deltas[index] ?? "", deltaWidth),
				dim(`gzipped ${prettyBytes(gzipped)}`),
			].join("  "),
			dim(`  ${BYTES.format(size)} bytes${was}`),
		];
	});
}

const command = createBaseCommand(
	"build-local",
	"1.0.0",
	"Build the plugin into plugins/small-rules.js with a readable summary.",
)
	.option("--no-minify", "Skip minification.")
	.action(async ({ minify }) => {
		const previousSizes = await Promise.all(ARTIFACTS.map(async ({ path }) => getSizeAsync(path)));
		const { logger, logs } = createCapturingLogger();

		const inlineConfiguration = {
			checks: { pluginTimings: false },
			customLogger: logger,
			// Read by tsdown.config.ts, which copies dist/index.js into plugins/.
			includeLocal: true,
			// Hides the global logger's config file and build start notes.
			logLevel: "warn",
			minify,
		} satisfies InlineConfig & { readonly includeLocal: boolean };

		const startTime = performance.now();
		let failure: unknown;
		try {
			await build(inlineConfiguration);
		} catch (error) {
			failure = error;
		}

		const duration = prettyMilliseconds(performance.now() - startTime);

		if (failure !== undefined || logs.errors.length > 0) {
			const messages = failure === undefined ? logs.errors : [...logs.errors, stringify([failure])];
			const lines = [`${red("✗")} ${bold.red("Build failed")} ${dim("after")} ${duration}`, "", ...messages, ""];
			console.error(renderBox(lines, red));
			exit(1);
		}

		const measurements = await Promise.all(ARTIFACTS.map(async ({ path }) => measureAsync(path)));
		const lines = [
			`${green("✓")} ${bold.green("Build successful")} ${dim("in")} ${duration}`,
			"",
			`${dim("Duration")}  ${bold.cyan(duration)}`,
			`${dim("Mode    ")}  ${minify ? "minified" : "unminified"}`,
			`${dim("Output  ")}  ${cyan("plugins/small-rules.js")}`,
			`${dim("Checks  ")}  ${describeChecks(logs.successes)}`,
			"",
			...renderArtifactLines(measurements, previousSizes),
			"",
		];

		console.log(renderBox(lines, cyan));
		for (const warning of logs.warnings) console.warn(`${yellow("⚠")} ${warning}`);
	});

await command.parse();
