import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";

import type { ViteUserConfig } from "vitest/config";

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

/**
 * The Vitest project for one workspace package, whose tests are the
 * `*.test.ts` files beside its source in `src`.
 *
 * @param name - Project name, matching the package name without its scope.
 * @returns The package's Vitest configuration.
 */
export function createPackageConfiguration(name: string): ViteUserConfig {
	return mergeConfig(
		sharedConfiguration,
		defineConfig({
			test: {
				name,
				include: ["src/**/*.test.ts"],
				testTimeout: 5_000,
			},
		}),
	);
}
