import type { KnipConfig } from "knip";

const PLUGIN_ENTRY = "plugin/index.ts";
const PLUGIN_PROJECT = "plugin/**/*.ts";

const configuration: KnipConfig = {
	bun: true,
	ignoreBinaries: ["hk", "nlx", "nr", "xdg-open"],
	ignoreDependencies: [
		"@fast-check/vitest",
		"fast-check",
		"sfw",
		"oxlint-plugin-*",
		"file:",
		"eslint-plugin-pnpm",
		"@mitata/counters",
	],
	ignoreFiles: ["tests/fixtures/**"],
	tags: ["-knipignore"],
	workspaces: {
		".": {
			entry: ["src/reset.d.ts!", "*.config.ts", "tests/**/*.fuzz.ts"],
			project: ["src/**/*.{ts,tsx}!", "tests/**/*.{ts,tsx}", "*.config.ts"],
		},
		".benchmarks": {
			entry: ["*.bench.ts"],
			project: ["**/*.bench.ts"],
		},
		".omp": {
			entry: ["hooks/**/*.ts"],
			project: ["hooks/**/*.ts"],
		},
		".opencode": {
			entry: ["core/**/*.ts", "plugins/**/*.ts"],
			project: ["core/**/*.ts", "plugins/**/*.ts"],
		},
		".opencode/packages/plugins/env-protection": {
			entry: [PLUGIN_ENTRY],
			project: [PLUGIN_PROJECT],
		},
		".opencode/packages/plugins/run-hk-check-on-idle": {
			entry: [PLUGIN_ENTRY],
			project: [PLUGIN_PROJECT],
		},
		documentation: {
			ignoreDependencies: ["babel-plugin-react-compiler", "satteri"],
		},
		"packages/arktype-utilities": {
			project: ["src/**/*.ts"],
		},
		scripts: {
			entry: ["*.ts"],
			project: ["**/*.ts"],
		},
	},
};

export default configuration;
