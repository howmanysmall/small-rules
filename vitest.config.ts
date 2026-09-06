import { availableParallelism } from "node:os";
import { argv, env } from "node:process";
import { vitiatePlugin } from "@vitiate/core";
import { defineConfig, mergeConfig } from "vitest/config";

const isVitiateRun = env.VITIATE_FUZZ === "1" || env.VITIATE_SUPERVISOR === "1" || env.VITIATE_OPTIMIZE === "1";
const isFocusedRun = argv.slice(2).some((argument) => argument.endsWith(".test.ts") || argument.startsWith("tests/"));

const cpuCount = availableParallelism();
const workerCount = Math.max(2, Math.min(cpuCount - 1, 12));

export const sharedConfiguration = defineConfig({
	resolve: { tsconfigPaths: true },
	test: {
		bail: 1,
		coverage: {
			clean: true,
			enabled: !isFocusedRun && !isVitiateRun,
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
			reportOnFailure: false,
			reportsDirectory: "./coverage",
			thresholds: { 100: true },
		},
		environment: "node",
		fileParallelism: true,
		globals: true,
		isolate: false,
		maxConcurrency: 64,
		maxWorkers: workerCount,
		pool: "forks",
		testTimeout: 30_000,
		typecheck: {
			checker: "tsgo",
			enabled: !isVitiateRun,
			include: ["tests/**/*.test.ts", "tests/**/*.test-d.ts"],
			tsconfig: "./tsconfig.test.json",
		},
	},
});

const configuration = mergeConfig(
	sharedConfiguration,
	defineConfig({
		plugins: isVitiateRun ? [vitiatePlugin()] : [],
		test: isVitiateRun
			? { include: ["tests/**/*.fuzz.ts"] }
			: {
					// Packages own a vitest.config.ts; its `include` wins for its files.
					projects: [
						{
							test: {
								name: "small-rules",
								include: ["tests/**/*.test.ts"],
							},
						},
						"packages/*",
					],
				},
	}),
);

export default configuration;
