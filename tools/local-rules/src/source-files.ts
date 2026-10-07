import { readdirSync } from "node:fs";

import type { ESTree } from "oxlint-plugin-utilities";
import type { Node as YukuNode } from "yuku-parser";

// Declaration files and tests never reach the bundle.
const BUNDLED_SOURCE = /(?<!\.d|\.test)\.tsx?$/v;

/**
 * The source files under `directory` that end up in the bundle.
 *
 * @param directory - Directory to read recursively.
 * @returns Paths relative to `directory`.
 */
export function listBundledSources(directory: string): ReadonlyArray<string> {
	const relativePaths = readdirSync(directory, { encoding: "utf8", recursive: true });
	return relativePaths.filter((relativePath) => BUNDLED_SOURCE.test(relativePath));
}

/**
 * Yuku and Oxlint share the ESTree shape, so a yuku node of a given type is
 * also the Oxlint node of that type.
 *
 * @template TType - Node type to match.
 * @param node - Yuku node.
 * @param type - Node type to match.
 * @returns Whether `node` has that type.
 */
export function isOfType<TType extends ESTree.Node["type"]>(
	node: YukuNode,
	type: TType,
): node is Extract<ESTree.Node, { type: TType }> & YukuNode {
	return node.type === type;
}
