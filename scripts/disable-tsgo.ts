#!/usr/bin/env bun

import { relative, resolve } from "node:path";
import { cwd } from "node:process";
import { editJsonc } from "$script-utilities/jsonc-utilities";
import { Command } from "@cliffy/command";
import { type } from "arktype";
import { argv, JSONC, file, write } from "bun";
import { fdir } from "fdir";
import { create } from "mutative";
import { bold, cyan, dim, green, red, yellow } from "picocolors";

const fdirZed = new fdir().glob("**/.zed/settings.json").withFullPaths();

const isZedSettingsJson = type({
	"[string]": "unknown",
	"language_servers?": type("string[]").readonly().or("undefined"),
	"languages?": type
		.Record(
			"string",
			type({
				"[string]": "unknown",
				"language_servers?": "string[] | undefined",
			}).readonly(),
		)
		.readonly()
		.or("undefined"),
}).readonly();

const isSettingsJson = type({
	content: "string",
	filePath: "string",
}).readonly();
type SettingsJson = typeof isSettingsJson.infer;

async function getSettingsJsonAsync(filePath: string): Promise<SettingsJson | undefined> {
	try {
		const content = await file(filePath).text();
		if (!content.includes('"tsgo"')) return undefined;

		const zedSettings = JSONC.parse(content);
		return isZedSettingsJson.allows(zedSettings) ? { content, filePath } : undefined;
	} catch {
		return undefined;
	}
}
async function getSettingsJsonsAsync(settingsPaths: ReadonlyArray<string>): Promise<ReadonlyArray<SettingsJson>> {
	const results = await Promise.all(settingsPaths.map(getSettingsJsonAsync));
	return results.filter((value): value is SettingsJson => value !== undefined);
}

const enum Operation {
	Equal = 0x00,
	Delete = 0x01,
	Add = 0x02,
}

interface DiffOperation {
	readonly line: string;
	readonly operation: Operation;
}

function* lcsDiff(oldLines: ReadonlyArray<string>, newLines: ReadonlyArray<string>): Generator<DiffOperation> {
	const oldRowCount = oldLines.length;
	const newColumnCount = newLines.length;
	const size = (oldRowCount + 1) * (newColumnCount + 1);
	const dp = Array.from<number>({ length: size }).fill(0);

	function index(row: number, column: number): number {
		return row * (newColumnCount + 1) + column;
	}

	for (let row = 1; row <= oldRowCount; row += 1) {
		for (let column = 1; column <= newColumnCount; column += 1) {
			const self = index(row, column);
			const diag = index(row - 1, column - 1);
			const up = index(row - 1, column);
			const left = index(row, column - 1);
			dp[self] =
				(oldLines[row - 1] ?? "") === (newLines[column - 1] ?? "")
					? (dp[diag] ?? 0) + 1
					: Math.max(dp[up] ?? 0, dp[left] ?? 0);
		}
	}

	const result = new Array<DiffOperation>();
	let row = oldRowCount;
	let column = newColumnCount;
	while (row > 0 || column > 0) {
		if (row > 0 && column > 0 && (oldLines[row - 1] ?? "") === (newLines[column - 1] ?? "")) {
			result.push({ line: oldLines[row - 1] ?? "", operation: Operation.Equal });
			row -= 1;
			column -= 1;
		} else if (
			column > 0 &&
			(row === 0 || (dp[index(row, column - 1)] ?? 0) >= (dp[index(row - 1, column)] ?? 0))
		) {
			result.push({ line: newLines[column - 1] ?? "", operation: Operation.Add });
			column -= 1;
		} else {
			result.push({ line: oldLines[row - 1] ?? "", operation: Operation.Delete });
			row -= 1;
		}
	}

	yield* result.toReversed();
}

const CTX = 3;
function expandChangeRegion(operations: ReadonlyArray<DiffOperation>, startIndex: number): number {
	let rawEnd = startIndex;
	let pendingEqual = 0;

	while (rawEnd < operations.length) {
		const operation = operations[rawEnd];
		if (operation === undefined) break;

		if (operation.operation !== Operation.Equal) pendingEqual = 0;
		else if (pendingEqual >= CTX) break;
		else pendingEqual += 1;

		rawEnd += 1;
	}

	return rawEnd;
}

function collectRegions(
	operations: ReadonlyArray<DiffOperation>,
): ReadonlyArray<{ readonly start: number; readonly end: number }> {
	const regions = new Array<{ start: number; end: number }>();
	let scanIndex = 0;

	while (scanIndex < operations.length) {
		if (operations[scanIndex]?.operation === Operation.Equal) {
			scanIndex += 1;
			continue;
		}

		const rawStart = Math.max(0, scanIndex - CTX);
		const rawEnd = Math.min(expandChangeRegion(operations, scanIndex) + CTX, operations.length);

		const lastRegion = regions.at(-1);
		if (lastRegion !== undefined && rawStart <= lastRegion.end) lastRegion.end = rawEnd;
		else regions.push({ end: rawEnd, start: rawStart });

		scanIndex = rawEnd;
	}

	return regions;
}

function countLines(
	operations: ReadonlyArray<DiffOperation>,
	upTo: number,
): { readonly oldNumber: number; readonly newNumber: number } {
	let oldNumber = 1;
	let newNumber = 1;
	for (const [index, operation] of operations.entries()) {
		if (index >= upTo) break;
		if (operation.operation === Operation.Equal || operation.operation === Operation.Delete) oldNumber += 1;
		if (operation.operation === Operation.Equal || operation.operation === Operation.Add) newNumber += 1;
	}
	return { newNumber, oldNumber };
}

function formatDiff(filePath: string, oldContent: string, newContent: string): string {
	const oldLines = oldContent.split("\n");
	const newLines = newContent.split("\n");
	const operations = [...lcsDiff(oldLines, newLines)];
	const regions = collectRegions(operations);

	if (regions.length === 0) return "";

	const out = [cyan(`--- ${filePath}`), cyan(`+++ ${filePath}`)];

	for (const { start, end } of regions) {
		const { oldNumber: regionOldStart, newNumber: regionNewStart } = countLines(operations, start);

		const hunkLines = new Array<string>();
		let oldCount = 0;
		let newCount = 0;

		for (let offset = start; offset < end; offset += 1) {
			const operation = operations[offset];
			if (operation === undefined) continue;
			if (operation.operation === Operation.Equal) {
				hunkLines.push(` ${operation.line}`);
				oldCount += 1;
				newCount += 1;
			} else if (operation.operation === Operation.Delete) {
				hunkLines.push(red(`-${operation.line}`));
				oldCount += 1;
			} else {
				hunkLines.push(green(`+${operation.line}`));
				newCount += 1;
			}
		}

		out.push(dim(`@@ -${regionOldStart},${oldCount} +${regionNewStart},${newCount} @@`), ...hunkLines);
	}

	return out.join("\n");
}

function flip(value: string): string {
	if (value === "tsgo") return "!tsgo";
	if (value === "!vtsls") return "vtsls";
	return value;
}

function needsVtsls(languageServers: ReadonlyArray<string>): boolean {
	return languageServers.includes("tsgo") || languageServers.includes("!vtsls");
}

function insertVtsls(languageServers: Array<string>): void {
	const ellipsisIndex = languageServers.indexOf("...");
	if (ellipsisIndex === languageServers.length - 1) {
		languageServers.pop();
		languageServers.push("vtsls", "...");
	} else languageServers.push("vtsls");
}

function flipAndAddVtsls(languageServers: ReadonlyArray<string>): Array<string> {
	const addVtsls = needsVtsls(languageServers);
	const result = languageServers.map(flip);
	if (addVtsls && !result.includes("vtsls")) insertVtsls(result);
	return result;
}

function disableTsgoInSettings(content: string): string {
	return editJsonc(content, isZedSettingsJson.assert, (zedSettings) =>
		create(zedSettings, (draft) => {
			if (draft.language_servers !== undefined) draft.language_servers = flipAndAddVtsls(draft.language_servers);

			const { languages } = draft;
			if (languages) {
				for (const language of Object.values(languages)) {
					if (!language.language_servers) continue;
					language.language_servers = flipAndAddVtsls(language.language_servers);
				}
			}

			return draft;
		}),
	);
}

function processSettingsFile(
	{ content, filePath }: SettingsJson,
	scanRoot: string,
	dryRun: boolean,
	writes: Array<Promise<unknown>>,
): boolean {
	const updatedContents = disableTsgoInSettings(content);
	if (updatedContents === content) return false;

	if (dryRun) {
		const relativePath = relative(scanRoot, filePath);
		const label = relativePath.startsWith("..") ? filePath : relativePath;
		console.log(formatDiff(label, content, updatedContents));
		console.log();
	} else writes.push(write(filePath, updatedContents));

	return true;
}

function printDryRunHeader(scanRoot: string, count: number): void {
	console.log(`${yellow("⚠")}  ${bold("DRY RUN")}${dim(" — no files will be modified")}`);
	console.log();
	console.log(`${dim("🔍")} Scanning from ${cyan(scanRoot)}`);
	console.log(`${dim("📁")} Found ${bold(String(count))} ${count === 1 ? "file" : "files"} with tsgo references`);
	console.log();
}

function printSummary(changedCount: number, scannedCount: number, dryRun: boolean): void {
	if (changedCount === 0) {
		console.log(`${green("✓")} All ${bold(String(scannedCount))} files already clean. Nothing to do.`);
		return;
	}

	if (dryRun) {
		console.log(`${dim("───")} ${bold("Summary")} ${dim("───")}`);
		console.log(`${yellow(String(changedCount))} ${changedCount === 1 ? "file would" : "files would"} be modified`);
		console.log(`${dim("No files were actually written")} ${yellow("(--dry-run)")}`);
	} else console.log(`${green("✓")} ${bold(String(changedCount))} ${changedCount === 1 ? "file" : "files"} modified`);
}

const command = new Command()
	.name("disable-tsgo")
	.description("Disables the extremely broken and terrible `tsgo` language server in Zed settings.")
	.version("0.1.0")
	.option("--dry-run, -n", "Show what would change without modifying anything. Default: false", { default: false })
	.argument("<scan-from:string>", "Where to start your scan from.", {
		default: cwd(),
	})
	.action(async (options: { readonly dryRun: unknown }, scanFrom: string) => {
		const dryRun = options.dryRun === true;
		const scanRoot = resolve(scanFrom);

		const settingsPaths = await fdirZed.crawl(scanRoot).withPromise();
		const settingsJsons = await getSettingsJsonsAsync(settingsPaths);

		if (settingsJsons.length === 0) {
			console.log(`${dim("🔍")} ${bold("No files found")} containing tsgo references under ${cyan(scanRoot)}`);
			return;
		}

		if (dryRun) printDryRunHeader(scanRoot, settingsJsons.length);

		const writes: Array<Promise<unknown>> = [];
		let changedCount = 0;

		for (const settings of settingsJsons) {
			const changed = processSettingsFile(settings, scanRoot, dryRun, writes);
			if (changed) changedCount += 1;
		}

		if (!dryRun) await Promise.all(writes);

		printSummary(changedCount, settingsJsons.length, dryRun);
	});

await command.parse(argv.slice(2));
