import { defineConfig, mergeConfig } from "vitest/config";

import { sharedConfiguration } from "./vitest.shared.config.ts";

/**
 * Config used by Stryker's Vitest runner.
 *
 * Flat on purpose: `stryker.config.mjs` only mutates root `src`, so pulling in
 * the `projects` list would run the documentation and package suites for every
 * mutant without any of them being able to kill one. Stryker also overrides
 * `pool`, `maxWorkers`, `maxConcurrency`, `bail`, and `coverage` at the CLI
 * layer, which resolves cleanly against a single config but not across
 * separately-loaded project configs.
 */
const configuration = mergeConfig(
	sharedConfiguration,
	defineConfig({
		test: {
			name: "small-rules",
			coverage: { enabled: false },
			include: ["tests/**/*.test.ts"],
			// Stryker swaps the active mutant between runs, so each file needs a
			// fresh module registry.
			isolate: true,
			typecheck: { enabled: false },
		},
	}),
);

export default configuration;
