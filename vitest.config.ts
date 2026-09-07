import { env } from "node:process";
import { defineConfig, mergeConfig } from "vitest/config";

import { sharedConfiguration } from "./vitest.shared.config.ts";
import fuzzConfiguration from "./vitest.vitiate.config.ts";

/**
 * Vitiate's supervisor respawns Vitest once per fuzz target, but the
 * `--config` it passes comes from `getConfigFile()`, main-process state
 * that never reaches the pool worker doing the respawn. The child starts
 * with no `--config` and auto-discovers this file, so it has to turn
 * itself into the fuzz config or it finds no test files and exits 1.
 *
 * `vitiate regression` is driven by `--config` alone and never lands here.
 */
const isFuzzRun = env.VITIATE_FUZZ === "1" || env.VITIATE_OPTIMIZE === "1" || env.VITIATE_SUPERVISOR === "1";

const testConfiguration = mergeConfig(
	sharedConfiguration,
	defineConfig({
		test: {
			// Coverage is a run-level option, so it lives here rather than in a
			// project. Opt in with `--coverage` (see the `test` script) instead
			// of guessing from argv.
			coverage: {
				clean: true,
				exclude: [
					"documentation/**",
					"packages/**/src/**/*.test.ts",
					"src/index.ts",
					"src/types/**/*.ts",
					"src/utilities/prevent-abbreviations/types.ts",
				],
				include: ["packages/*/src/**/*.ts", "src/**/*.ts"],
				provider: "v8",
				reporter: ["text", "html", "text-summary"],
				reportOnFailure: true,
				reportsDirectory: "./coverage",
				thresholds: { 100: true },
			},
			projects: [
				{
					test: {
						name: "small-rules",
						include: ["tests/**/*.test.ts"],
					},
				},
				{
					// Type-level assertions run as their own project so a `tsgo`
					// failure is reported separately instead of doubling every
					// runtime test file in the summary.
					test: {
						name: "types",
						typecheck: {
							checker: "tsgo",
							enabled: true,
							include: ["tests/**/*.test.ts", "tests/**/*.test-d.ts"],
							only: true,
							tsconfig: "./tsconfig.test.json",
						},
					},
				},
				// Referenced projects keep their own config; `extends` does not
				// apply to them.
				"documentation",
				"packages/*",
			],
		},
	}),
);

const configuration = isFuzzRun ? fuzzConfiguration : testConfiguration;

export default configuration;
