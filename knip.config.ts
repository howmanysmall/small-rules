import type { KnipConfig } from "knip";

const configuration: KnipConfig = {
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
	project: ["src/**/*.{ts,tsx}", "tests/**/*.{ts,tsx}", "scripts/**/*.{ts,tsx,d.ts}", "*.config.ts"],
};

export default configuration;
