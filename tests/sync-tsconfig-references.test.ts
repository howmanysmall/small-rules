import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import nodePath from "node:path";
import { describe, expect, it, onTestFinished } from "vitest";

import { findStaleReferencesAsync, syncTsconfigReferencesAsync } from "$script-utilities/sync-tsconfig-references";

// Bugs these tests guard: the solution `tsconfig.json` silently missing a
// workspace project (a stale `tsgo --build` graph), package tsconfigs declaring
// project references the compiler rejects (TS6306 — workspace packages do not
// emit declarations), and sync reformatting or dropping keys it did not intend
// to touch. Every expected string is hand-written from the repository's own
// `tsconfig.json` shape, never produced by the script under test.

const TSCONFIG_JSON = "tsconfig.json";

const PACKAGE_TSCONFIG = `{
	"extends": "../../tsconfig.base.json",
	"compilerOptions": {
		"lib": ["ESNext"]
	},
	"include": ["src/**/*.ts"]
}`;

const PACKAGE_TSCONFIG_WITH_ILLEGAL_REFERENCES = `{
	"extends": "../../tsconfig.base.json",
	"compilerOptions": {
		"lib": ["ESNext"]
	},
	"references": [
		{ "path": "../beta" }
	],
	"include": ["src/**/*.ts"]
}`;

// `JSON.stringify(value, undefined, "\t")` expands every non-empty array,
// unlike the repository's collapsed oxfmt style.
const PACKAGE_TSCONFIG_AFTER_SYNC = `{
	"extends": "../../tsconfig.base.json",
	"compilerOptions": {
		"lib": [
			"ESNext"
		]
	},
	"include": [
		"src/**/*.ts"
	]
}`;

const ROOT_CONFIGURATION = `{
	"files": []
}`;

const SOLUTION_SYNCED = `{
	"extends": "./tsconfig.base.json",
	"references": [
		{ "path": "./.codex" },
		{ "path": "./.omp" },
		{ "path": "./packages/alpha" },
		{ "path": "./packages/beta" },
		{ "path": "./tsconfig.lib.json" },
		{ "path": "./tsconfig.node.json" },
		{ "path": "./tsconfig.test.json" }
	],
	"files": [],
	"include": []
}`;

const SOLUTION_MISSING_BETA = `{
	"extends": "./tsconfig.base.json",
	"references": [
		{ "path": "./.codex" },
		{ "path": "./.omp" },
		{ "path": "./packages/alpha" },
		{ "path": "./tsconfig.lib.json" },
		{ "path": "./tsconfig.node.json" },
		{ "path": "./tsconfig.test.json" }
	],
	"files": [],
	"include": []
}`;

// `JSON.stringify(value, undefined, "\t")` spreads every reference object
// across three lines, unlike the repository's collapsed oxfmt style.
const SOLUTION_AFTER_SYNC = `{
	"extends": "./tsconfig.base.json",
	"references": [
		{
			"path": "./.codex"
		},
		{
			"path": "./.omp"
		},
		{
			"path": "./packages/alpha"
		},
		{
			"path": "./packages/beta"
		},
		{
			"path": "./tsconfig.lib.json"
		},
		{
			"path": "./tsconfig.node.json"
		},
		{
			"path": "./tsconfig.test.json"
		}
	],
	"files": [],
	"include": []
}`;

const EXPECTED_SOLUTION_REFERENCES = [
	"./.codex",
	"./.omp",
	"./packages/alpha",
	"./packages/beta",
	"./tsconfig.lib.json",
	"./tsconfig.node.json",
	"./tsconfig.test.json",
];

const SOLUTION_REFERENCES_WITHOUT_BETA = [
	"./.codex",
	"./.omp",
	"./packages/alpha",
	"./tsconfig.lib.json",
	"./tsconfig.node.json",
	"./tsconfig.test.json",
];

interface FixtureOptions {
	readonly illegalPackageReferences?: boolean;
	readonly omitBetaFromSolution?: boolean;
}

async function writeAsync(rootDirectory: string, relativePath: string, contents: string): Promise<void> {
	const filePath = nodePath.join(rootDirectory, relativePath);
	await mkdir(nodePath.dirname(filePath), { recursive: true });
	await writeFile(filePath, `${contents}\n`, "utf8");
}

function manifestFor(name: string): string {
	return `{
	"name": "${name}"
}`;
}

async function createWorkspaceAsync(options: FixtureOptions = {}): Promise<string> {
	const rootDirectory = await mkdtemp(nodePath.join(tmpdir(), "small-rules-references-"));

	await writeAsync(
		rootDirectory,
		TSCONFIG_JSON,
		options.omitBetaFromSolution === true ? SOLUTION_MISSING_BETA : SOLUTION_SYNCED,
	);
	await writeAsync(rootDirectory, "tsconfig.lib.json", ROOT_CONFIGURATION);
	await writeAsync(rootDirectory, "tsconfig.node.json", ROOT_CONFIGURATION);
	await writeAsync(rootDirectory, "tsconfig.test.json", ROOT_CONFIGURATION);
	await writeAsync(rootDirectory, "packages/alpha/package.json", manifestFor("@small-rules/alpha"));
	await writeAsync(
		rootDirectory,
		"packages/alpha/tsconfig.json",
		options.illegalPackageReferences === true ? PACKAGE_TSCONFIG_WITH_ILLEGAL_REFERENCES : PACKAGE_TSCONFIG,
	);
	await writeAsync(rootDirectory, "packages/beta/package.json", manifestFor("@small-rules/beta"));
	await writeAsync(rootDirectory, "packages/beta/tsconfig.json", PACKAGE_TSCONFIG);
	// A directory with a tsconfig but no manifest is not a workspace project.
	await writeAsync(rootDirectory, "packages/not-a-project/tsconfig.json", PACKAGE_TSCONFIG);
	await writeAsync(rootDirectory, ".codex/package.json", manifestFor("@small-rules/codex"));
	await writeAsync(rootDirectory, ".codex/tsconfig.json", PACKAGE_TSCONFIG);
	await writeAsync(rootDirectory, ".omp/package.json", manifestFor("@small-rules/omp"));
	await writeAsync(rootDirectory, ".omp/tsconfig.json", PACKAGE_TSCONFIG);
	// Workspace packages that are not part of the `tsgo --build` solution.
	await writeAsync(rootDirectory, "documentation/package.json", manifestFor("@small-rules/documentation"));
	await writeAsync(rootDirectory, "documentation/tsconfig.json", PACKAGE_TSCONFIG);
	await writeAsync(rootDirectory, "scripts/package.json", manifestFor("@small-rules/scripts"));
	await writeAsync(rootDirectory, "scripts/tsconfig.json", PACKAGE_TSCONFIG);

	return rootDirectory;
}

describe("sync-tsconfig-references", () => {
	describe("findStaleReferencesAsync", () => {
		it("reports no drift on a synced workspace", async () => {
			expect.assertions(1);

			const rootDirectory = await createWorkspaceAsync();
			onTestFinished(async () => rm(rootDirectory, { force: true, recursive: true }));

			const staleReferences = await findStaleReferencesAsync(rootDirectory);

			expect(staleReferences).toStrictEqual([]);
		});

		it("reports the solution when a workspace project is missing from its references", async () => {
			expect.assertions(1);

			const rootDirectory = await createWorkspaceAsync({ omitBetaFromSolution: true });
			onTestFinished(async () => rm(rootDirectory, { force: true, recursive: true }));

			const staleReferences = await findStaleReferencesAsync(rootDirectory);

			expect(staleReferences).toStrictEqual([
				{
					actualReferences: SOLUTION_REFERENCES_WITHOUT_BETA,
					expectedReferences: EXPECTED_SOLUTION_REFERENCES,
					path: TSCONFIG_JSON,
				},
			]);
		});

		it("reports a package tsconfig whose references tsgo cannot build", async () => {
			expect.assertions(1);

			const rootDirectory = await createWorkspaceAsync({ illegalPackageReferences: true });
			onTestFinished(async () => rm(rootDirectory, { force: true, recursive: true }));

			const staleReferences = await findStaleReferencesAsync(rootDirectory);

			expect(staleReferences).toStrictEqual([
				{
					actualReferences: ["../beta"],
					expectedReferences: [],
					path: "packages/alpha/tsconfig.json",
				},
			]);
		});

		it("leaves every file untouched while checking", async () => {
			expect.assertions(3);

			const rootDirectory = await createWorkspaceAsync({
				illegalPackageReferences: true,
				omitBetaFromSolution: true,
			});
			onTestFinished(async () => rm(rootDirectory, { force: true, recursive: true }));
			const solutionPath = nodePath.join(rootDirectory, TSCONFIG_JSON);
			const alphaPath = nodePath.join(rootDirectory, "packages/alpha/tsconfig.json");

			const solutionBefore = await readFile(solutionPath, "utf8");
			const alphaBefore = await readFile(alphaPath, "utf8");
			const staleReferences = await findStaleReferencesAsync(rootDirectory);

			expect(staleReferences).toHaveLength(2);
			await expect(readFile(solutionPath, "utf8")).resolves.toBe(solutionBefore);
			await expect(readFile(alphaPath, "utf8")).resolves.toBe(alphaBefore);
		});
	});

	describe("syncTsconfigReferencesAsync", () => {
		it("adds a missing workspace project to the solution", async () => {
			expect.assertions(2);

			const rootDirectory = await createWorkspaceAsync({ omitBetaFromSolution: true });
			onTestFinished(async () => rm(rootDirectory, { force: true, recursive: true }));

			const staleReferences = await syncTsconfigReferencesAsync(rootDirectory);

			expect(staleReferences.map(({ path }) => path)).toStrictEqual([TSCONFIG_JSON]);
			await expect(readFile(nodePath.join(rootDirectory, TSCONFIG_JSON), "utf8")).resolves.toBe(
				`${SOLUTION_AFTER_SYNC}\n`,
			);
		});

		it("removes package references tsgo cannot build without disturbing other keys", async () => {
			expect.assertions(2);

			const rootDirectory = await createWorkspaceAsync({ illegalPackageReferences: true });
			onTestFinished(async () => rm(rootDirectory, { force: true, recursive: true }));

			const staleReferences = await syncTsconfigReferencesAsync(rootDirectory);

			expect(staleReferences.map(({ path }) => path)).toStrictEqual(["packages/alpha/tsconfig.json"]);
			await expect(readFile(nodePath.join(rootDirectory, "packages/alpha/tsconfig.json"), "utf8")).resolves.toBe(
				`${PACKAGE_TSCONFIG_AFTER_SYNC}\n`,
			);
		});
	});
});
