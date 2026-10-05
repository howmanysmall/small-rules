import { readdirSync, readFileSync } from "node:fs";
import nodePath from "node:path";
import { ARRAY_EXPRESSION, BINARY_EXPRESSION, SWITCH_STATEMENT } from "@small-rules/oxlint-utilities";
import { walk } from "yuku-ast";
import { langFromPath, parse } from "yuku-parser";

import { collectArrayNodeTypes, collectCaseNodeTypes, collectComparedNodeTypes } from "./inline-node-types.ts";

import type { ESTree } from "oxlint-plugin-utilities";
import type { Node as YukuNode } from "yuku-parser";

/**
 * How many times a node type string is inlined across the bundle.
 *
 * @param nodeType - Node type string to count.
 * @param filename - File being linted; its saved copy is replaced by `liveCounts`.
 * @param liveCounts - Inline uses by node type in the current, possibly unsaved,
 * text of `filename`.
 */
export type CountUsage = (nodeType: string, filename: string, liveCounts: ReadonlyMap<string, number>) => number;

export interface ProjectUsageOptions {
	/** Directories whose source files end up in the bundle. */
	readonly directories: ReadonlyArray<string>;
	/** How long a scan is reused before the directories are read again. */
	readonly maxAgeMilliseconds: number;
	readonly now?: () => number;
}

interface ProjectScan {
	readonly countsByFile: ReadonlyMap<string, ReadonlyMap<string, number>>;
	readonly scannedAt: number;
	readonly totals: ReadonlyMap<string, number>;
}

// Declaration files and tests never reach the bundle.
const BUNDLED_SOURCE = /(?<!\.d|\.test)\.tsx?$/v;

/**
 * Yuku and Oxlint share the ESTree shape, so a yuku node of a given type is
 * also the Oxlint node of that type.
 *
 * @template TType - Node type to match.
 * @param node - Yuku node from the walk.
 * @param type - Node type to match.
 * @returns Whether `node` has that type.
 */
function isOfType<TType extends ESTree.Node["type"]>(
	node: YukuNode,
	type: TType,
): node is Extract<ESTree.Node, { type: TType }> & YukuNode {
	return node.type === type;
}

export function countInlineNodeTypes(source: string, filename: string): Map<string, number> {
	const { program } = parse(source, { lang: langFromPath(filename), sourceType: "module" });
	const literals = new Array<ESTree.StringLiteral>();
	walk(program, {
		enter(node) {
			if (isOfType(node, BINARY_EXPRESSION)) collectComparedNodeTypes(node, literals);
			else if (isOfType(node, SWITCH_STATEMENT)) collectCaseNodeTypes(node, literals);
			else if (isOfType(node, ARRAY_EXPRESSION)) collectArrayNodeTypes(node, literals);
		},
	});

	const counts = new Map<string, number>();
	for (const { value } of literals) counts.set(value, (counts.get(value) ?? 0) + 1);
	return counts;
}

function scanProject(directories: ReadonlyArray<string>, scannedAt: number): ProjectScan {
	const countsByFile = new Map<string, ReadonlyMap<string, number>>();
	const totals = new Map<string, number>();

	for (const directory of directories) {
		const relativePaths = readdirSync(directory, { encoding: "utf8", recursive: true });
		for (const relativePath of relativePaths) {
			if (!BUNDLED_SOURCE.test(relativePath)) continue;

			const filePath = nodePath.resolve(directory, relativePath);
			const counts = countInlineNodeTypes(readFileSync(filePath, "utf8"), filePath);
			countsByFile.set(filePath, counts);
			for (const [nodeType, count] of counts) totals.set(nodeType, (totals.get(nodeType) ?? 0) + count);
		}
	}

	return { countsByFile, scannedAt, totals };
}

export function createProjectUsageCounter({
	directories,
	maxAgeMilliseconds,
	now = Date.now,
}: ProjectUsageOptions): CountUsage {
	let scan: ProjectScan | undefined;

	return (nodeType, filename, liveCounts) => {
		const time = now();
		if (scan === undefined || time - scan.scannedAt >= maxAgeMilliseconds) scan = scanProject(directories, time);

		const savedCount = scan.countsByFile.get(nodePath.resolve(filename))?.get(nodeType) ?? 0;
		return (scan.totals.get(nodeType) ?? 0) - savedCount + (liveCounts.get(nodeType) ?? 0);
	};
}
