import { vitiatePlugin } from "@vitiate/core";
import { defineConfig, mergeConfig } from "vitest/config";

import { sharedConfiguration } from "./vitest.shared.config.ts";

/**
 * Config used by the `vitiate` CLI (`fuzz`, `regression`, `optimize`).
 *
 * Vitiate's supervisor spawns a fresh Vitest process per fuzz target and runs
 * exactly one target in it, so worker fan-out is pure startup cost here. The
 * timeout is disabled because `--fuzz-time` is a per-target budget owned by the
 * fuzzer; a 30s Vitest timeout would abort any longer campaign.
 */
const configuration = mergeConfig(
	sharedConfiguration,
	defineConfig({
		plugins: [vitiatePlugin()],
		test: {
			name: "fuzz",
			coverage: { enabled: false },
			fileParallelism: false,
			include: ["tests/**/*.fuzz.ts"],
			maxWorkers: 1,
			testTimeout: 0,
			typecheck: { enabled: false },
		},
	}),
);

export default configuration;
