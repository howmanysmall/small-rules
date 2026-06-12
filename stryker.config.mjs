/** @type {import("@stryker-mutator/api/core").PartialStrykerOptions} */
const configuration = {
	$schema: "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
	cleanTempDir: true,
	concurrency: "50%",
	coverageAnalysis: "perTest",
	ignorePatterns: ["/coverage"],
	incremental: true,
	mutate: ["src/**/*.ts", "!src/**/*.d.ts", "!src/index.ts", "!src/types/**/*.ts"],
	plugins: ["@stryker-mutator/vitest-runner"],
	reporters: ["clear-text", "progress", "html"],
	testRunner: "vitest",
	thresholds: {
		break: 70,
		high: 85,
		low: 70,
	},
	vitest: {
		configFile: "vitest.mutation.config.ts",
		related: true,
	},
};

export default configuration;
