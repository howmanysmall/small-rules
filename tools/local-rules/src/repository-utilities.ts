import nodePath from "node:path";

import { createUtilitiesIndexLoader } from "./utilities-index.ts";

import type { UtilitiesIndex } from "./utilities-index.ts";

export const REPOSITORY_ROOT = nodePath.resolve(import.meta.dirname, "../../..");

/** This repository's shared utility modules, re-read at most once a second. */
export const loadRepositoryUtilities: () => UtilitiesIndex = createUtilitiesIndexLoader({
	locations: [
		{
			directory: nodePath.join(REPOSITORY_ROOT, "packages/oxlint-utilities/src"),
			toSpecifier: () => "@small-rules/oxlint-utilities",
		},
		{
			directory: nodePath.join(REPOSITORY_ROOT, "src/utilities"),
			toSpecifier: (relativePath) => `$oxc-utilities/${relativePath}`,
		},
	],
	maxAgeMilliseconds: 1000,
});
