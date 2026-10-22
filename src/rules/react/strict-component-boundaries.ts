import nodePath from "node:path";
import { Predicate } from "effect";

import { toPascalCase } from "$oxc-utilities/casing-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import { resolveRelativeImport } from "$oxc-utilities/resolve-import";

import type { Visitor } from "oxlint-plugin-utilities";

function getPathSegmentsFromSource(source: string): ReadonlyArray<string> {
	return source.split("/").filter((part) => !part.startsWith("."));
}

function countParentTraversals(pathDiff: string): number {
	return pathDiff.split("/").filter((part) => part === "..").length;
}

function hasAnotherComponentInPath(pathParts: ReadonlyArray<string>): boolean {
	return pathParts.some((part) => part === toPascalCase(part) && !part.includes("."));
}

function isIndexFile(filePath: string): boolean {
	return nodePath.basename(filePath, nodePath.extname(filePath)) === "index";
}

function isValidFixtureImport(pathParts: ReadonlyArray<string>): boolean {
	if (!pathParts.includes("fixtures")) return false;

	const fixtureIndex = pathParts.indexOf("fixtures");
	const partsBeforeFixture = pathParts.slice(0, fixtureIndex);

	return !hasAnotherComponentInPath(partsBeforeFixture);
}

function isReachingIntoComponent(pathDifference: string, maxDepth: number): boolean {
	const pathParts = getPathSegmentsFromSource(pathDifference);
	if (isIndexFile(pathDifference) || isValidFixtureImport(pathParts)) return false;

	const includesComponents = pathParts.includes("components");
	if (includesComponents && pathParts.length > maxDepth + 1) return true;

	return (
		(includesComponents || countParentTraversals(pathDifference) > 1) &&
		hasAnotherComponentInPath(pathParts) &&
		pathParts.length > maxDepth
	);
}

const strictComponentBoundaries = createRule("strict-component-boundaries", "react", {
	create(context): Visitor {
		// oxlint-disable-next-line typescript/no-unnecessary-condition -- false flag.
		const rawOptions = context.options?.[0];
		const { allow = [], maxDepth = 1 } = Predicate.isObject(rawOptions) ? rawOptions : { allow: [], maxDepth: 1 };

		const allowPatterns = allow.map((pattern) => new RegExp(pattern, "u"));

		return {
			ImportDeclaration(node): void {
				const importSource = node.source.value;
				if (!importSource.startsWith(".") || allowPatterns.some((regexp) => regexp.test(importSource))) return;

				const { filename } = context;
				/* v8 ignore next -- @preserve import-boundary checks run with a concrete filename from Oxlint. */
				if (filename.length === 0) return;

				const resolved = resolveRelativeImport(importSource, filename);
				if (!resolved.found) return;

				const pathDifference = nodePath.relative(filename, resolved.path).replaceAll("\\", "/");
				if (isReachingIntoComponent(pathDifference, maxDepth)) {
					context.report({
						messageId: "noReachingIntoComponent",
						node,
					});
				}
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Prevent imports that reach into another component's nested modules.",
		},
		messages: {
			noReachingIntoComponent:
				"Do not reach into an individual component's folder for nested modules. Import from the closest shared components folder instead.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					allow: {
						default: [],
						description: "Regular expression patterns for imports allowed to cross component boundaries.",
						items: { type: "string" },
						type: "array",
					},
					maxDepth: {
						default: 1,
						description: "Maximum path depth allowed inside another component before reporting.",
						type: "integer",
					},
				},
				type: "object",
			} as const,
		] as const,
		type: "problem",
	},
});

export default strictComponentBoundaries;
