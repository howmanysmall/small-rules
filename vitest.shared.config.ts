import { availableParallelism } from "node:os";
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
		pool: "forks",
		testTimeout: 30_000,
	},
});
