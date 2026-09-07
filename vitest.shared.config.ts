import { availableParallelism } from "node:os";
import { defineConfig } from "vitest/config";

const cpuCount = availableParallelism();

/** Leave a core for the main thread, and never spin up more than we can use. */
const workerCount = Math.max(2, Math.min(cpuCount - 1, 12));

/**
 * Runtime settings every Vitest entry point needs.
 *
 * Deliberately free of `coverage`, `typecheck`, `projects`, and plugins: the
 * mutation and fuzz runners load this file on every process start, so anything
 * they cannot use belongs in the config that actually wants it.
 */
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
