import { availableParallelism } from "node:os";
import { argv, env } from "node:process";
import { vitiatePlugin } from "@vitiate/core";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

const isVitiateRun = env.VITIATE_FUZZ === "1" || env.VITIATE_SUPERVISOR === "1" || env.VITIATE_OPTIMIZE === "1";
const isFocusedRun = argv.slice(2).some((argument) => argument.endsWith(".test.ts") || argument.startsWith("tests/"));

const cpuCount = availableParallelism();
const workerCount = Math.max(2, Math.min(cpuCount - 1, 12));

const tsconfig = tsconfigPaths();

const configuration = defineConfig({
	plugins: isVitiateRun ? [vitiatePlugin(), tsconfig] : [tsconfig],
	test: {
		bail: 1,
		coverage: {
			clean: true,
			enabled: !(isFocusedRun || isVitiateRun),
			exclude: ["src/index.ts", "src/types/**/*.ts"],
			include: ["src/**/*.ts"],
			provider: "v8",
			reporter: ["text", "html", "text-summary"],
			reportOnFailure: false,
			reportsDirectory: "./coverage",
			thresholds: { branches: 0, functions: 0, lines: 0, statements: 0 },
		},
		environment: "node",
		fileParallelism: true,
		globals: true,
		include: isVitiateRun ? ["tests/**/*.fuzz.ts"] : ["tests/**/*.test.ts"],
		isolate: false,
		maxConcurrency: 64,
		maxWorkers: workerCount,
		pool: "forks",
		testTimeout: 30_000,
		typecheck: {
			checker: "tsgo",
			enabled: !isVitiateRun,
			include: ["tests/**/*.test.ts", "tests/**/*.test-d.ts"],
			tsconfig: "./tsconfig.json",
		},
	},
});

export default configuration;
