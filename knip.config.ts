import { glob } from "node:fs/promises";
import { cwd } from "node:process";
import { getTsconfig } from "get-tsconfig";

import type { TsConfigResult } from "get-tsconfig";
import type { KnipConfig } from "knip";

const CWD = cwd();

async function getPathsAsync(): Promise<Record<string, Array<string>>> {
	const tsconfigResults = new Array<TsConfigResult>();
	let size = 0;

	for await (const filePath of glob("tsconfig*.json", { cwd: CWD })) {
		const tsconfigResult = getTsconfig(CWD, filePath);
		if (tsconfigResult === null) continue;
		tsconfigResults[size++] = tsconfigResult;
	}

	const paths: Record<string, Array<string>> = {};
	for (const tsconfigResult of tsconfigResults) {
		const tsconfigPaths = tsconfigResult.config.compilerOptions?.paths;
		if (tsconfigPaths === undefined) continue;

		for (const [key, value] of Object.entries(tsconfigPaths)) {
			if (key in paths) {
				console.warn(`Duplicate path key detected: ${key}`);
				paths[key]?.push(...value);
			} else paths[key] = value;
		}
	}

	return paths;
}

const paths = await getPathsAsync();

const configuration: KnipConfig = {
	bun: true,
	entry: ["commitlint.config.ts", "vitest.mutation.config.ts", "vitest.vitiate.config.ts"],
	ignoreBinaries: ["hk"],
	ignoreDependencies: [
		"@commitlint/config-conventional",
		"@fast-check/vitest",
		"@vitiate/fuzzed-data-provider",
		"fast-check",
		"package-manager-detector",
		"sfw",
	],
	ignoreFiles: ["tests/fixtures/**", "scripts/reset.d.ts"],
	paths,
	project: ["src/**/*.{ts,tsx}", "tests/**/*.{ts,tsx}", "scripts/**/*.{ts,tsx,d.ts}", "*.config.ts"],
	tsdown: true,
};

export default configuration;
