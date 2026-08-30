import type { KnipConfig } from "knip";

const configuration: KnipConfig = {
	bun: true,
	ignoreBinaries: ["hk", "nlx", "nr", "xdg-open"],
	ignoreDependencies: ["@fast-check/vitest", "fast-check", "sfw", "oxlint-plugin-*", "file:"],
	ignoreExportsUsedInFile: { interface: true, type: true },
	ignoreFiles: ["tests/fixtures/**"],
	workspaces: {
		".": {
			entry: ["*.config.ts", "src/reset.d.ts", "tests/**/*.fuzz.ts"],
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
			ignoreDependencies: ["babel-plugin-react-compiler", "satteri"],
		},
		scripts: {
			entry: ["*.ts"],
			project: ["**/*.ts"],
		},
	},
};

export default configuration;
