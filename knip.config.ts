import { glob } from "node:fs/promises";
import { cwd } from "node:process";
import { getTsconfig } from "get-tsconfig";

import type { TsConfigResult } from "get-tsconfig";
import type { KnipConfig } from "knip";

const CWD = cwd();

async function getPathsAsync(): Promise<Record<string, Array<string>>> {
	const tsconfigResults = new Array<TsConfigResult>();
	let size = 0;

	const filePaths = glob("tsconfig*.json", { cwd: CWD });
	for await (const filePath of filePaths) {
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
				// oxlint-disable-next-line small-rules/no-variadic-spread -- not a relevant hot path.
				paths[key]?.push(...value);
			} else paths[key] = value;
		}
	}

	return paths;
}

const paths = await getPathsAsync();

const configuration: KnipConfig = {
	bun: true,
	ignoreBinaries: ["hk", "nr", "xdg-open", "nlx"],
	ignoreDependencies: [
		"@commitlint/config-conventional",
		"@fast-check/vitest",
		"@oh-my-pi/pi-coding-agent",
		"arktype",
		"fast-check",
		"file:",
		"sfw",
		"eslint-plugin-*",
		"oxlint-plugin-*",
	],
	ignoreExportsUsedInFile: true,
	ignoreFiles: ["tests/fixtures/**"],
	tsdown: true,
	workspaces: {
		".": {
			entry: ["*.config.ts", "tests/**/*.fuzz.ts"],
			paths,
			project: ["src/**/*.{ts,tsx}", "tests/**/*.{ts,tsx}", "*.config.ts"],
		},
		".omp": {
			entry: ["hooks/**/*.ts"],
			project: ["hooks/**/*.ts"],
		},
		".opencode": {
			entry: ["plugin/**/*.ts"],
			project: ["plugin/**/*.ts"],
		},
		documentation: {
			// Optional peer for Starlight's Sätteri markdown branch (type
			// ambient + peer resolution).
			ignoreDependencies: ["babel-plugin-react-compiler", "satteri"],
		},
		scripts: {
			entry: ["**/*.ts"],
			project: ["**/*.ts"],
		},
	},
};

export default configuration;
