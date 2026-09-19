import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const cpuCount = availableParallelism();
const workerCount = Math.max(2, Math.min(cpuCount - 1, 12));

export const sharedConfiguration = defineConfig({
	resolve: { tsconfigPaths: true },
	test: {
		environment: "node",
		fileParallelism: true,
		globals: true,
		isolate: false,
		maxWorkers: workerCount,
		passWithNoTests: true,
		pool: "forks",
		setupFiles: [fileURLToPath(new URL("setup.ts", import.meta.url))],
		testTimeout: 30_000,
	},
});
