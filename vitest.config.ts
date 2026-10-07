import { argv, env } from "node:process";
import { sharedConfiguration } from "@small-rules/vite-configuration";
import { vitiateConfiguration } from "@small-rules/vite-configuration/vitiate";
import { defineConfig, mergeConfig } from "vitest/config";

// vitiate respawns vitest per fuzz target without forwarding --config, so the
// child auto-discovers this file and has to become the fuzz config.
const isFuzzRun = env.VITIATE_FUZZ === "1" || env.VITIATE_OPTIMIZE === "1" || env.VITIATE_SUPERVISOR === "1";

const NARROWING_FLAGS = new Set(["--changed", "--project", "--related", "--shard", "--testNamePattern", "-t"]);
const TEST_FILE_ARGUMENT = /\.(?:fuzz|test)\.[cm]?tsx?$/u;

function isFocusedRun(cliArguments: ReadonlyArray<string>): boolean {
	return cliArguments.some((argument) => {
		if (argument.startsWith("-")) {
			return NARROWING_FLAGS.has(argument.split("=", 1)[0] ?? argument);
		}
		return argument.startsWith("tests/") || TEST_FILE_ARGUMENT.test(argument);
	});
}

const enabled = !isFocusedRun(argv.slice(2));

const testConfiguration = mergeConfig(
	sharedConfiguration,
	defineConfig({
		test: {
			benchmark: {
				include: ["tests/**/*.bench.ts"],
			},
			coverage: {
				clean: true,
				enabled,
				exclude: [
					"**/*.test.ts",
					"src/index.ts",
					"src/types/**/*.ts",
					"src/utilities/prevent-abbreviations/types.ts",
					// Build and test tooling: nothing ships from these.
					"tools/{lint-configurations,linter-utilities,rule-harness,vite-configuration}/**",
				],
				include: ["src/**/*.ts", "{packages,tools}/*/src/**/*.ts"],
				provider: "v8",
				reporter: ["text", "html", "text-summary", "json", "json-summary"],
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
					test: {
						name: "types",
						benchmark: { exclude: ["**/*"] },
						typecheck: {
							checker: "tsgo",
							enabled: true,
							include: ["tests/**/*.test.ts", "tests/**/*.test-d.ts"],
							only: true,
							tsconfig: "./tsconfig.test.json",
						},
					},
				},
				"documentation",
				"packages/*/vitest.config.ts",
				"tools/*/vitest.config.ts",
			],
		},
	}),
);

const configuration = isFuzzRun ? vitiateConfiguration : testConfiguration;

export default configuration;
