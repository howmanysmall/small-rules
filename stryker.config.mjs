/** @type {import("@stryker-mutator/api/core").PartialStrykerOptions} */
const configuration = {
	$schema: "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
	cleanTempDir: true,
	concurrency: "50%",
	// Stryker defaults this to `true`, which prepends `// @ts-nocheck` to every
	// source and fixture file and shifts every line number by one. This repo
	// asserts on rule diagnostic positions, so that silently breaks the suite.
	// Nothing runs `tsc` in the sandbox anyway — see `vitest.mutation.config.ts`,
	// which disables typechecking.
	disableTypeChecks: false,
	ignorePatterns: [
		"/.claude",
		"/.codegraph",
		"/.stryker-tmp",
		"/.swc",
		"/.vitiate",
		"/coverage",
		"/dist",
		"/do-not-sync-ever",
		"/documentation/dist",
		"/documentation/node_modules",
		"/documentation/test-results",
		"/reports",
	],
	incremental: true,
	mutate: ["src/**/*.ts", "!src/**/*.d.ts", "!src/index.ts", "!src/types/**/*.ts", "!**/generated/**"],
	plugins: ["@stryker-mutator/vitest-runner"],
	reporters: ["clear-text", "progress", "html"],
	testRunner: "vitest",
	thresholds: {
		break: 70,
		high: 85,
		low: 70,
	},
	// A mutant run pays ~20s of Vitest startup before a test executes, so give
	// slow CI hardware headroom. A genuine infinite loop is still caught.
	timeoutMS: 30_000,
	vitest: {
		configFile: "vitest.mutation.config.ts",
		// `related` asks Vitest which test files import the mutated module, which
		// resolves nothing useful here — imports go through `$oxc-rules/*`
		// tsconfig path aliases. With it enabled the dry run only executes a
		// subset, which is what hid the `disableTypeChecks` breakage above.
		// Per-test coverage from a full dry run is accurate and cheap enough.
		related: false,
	},
};

export default configuration;
