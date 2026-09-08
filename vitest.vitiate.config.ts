import { vitiatePlugin } from "@vitiate/core";
import { defineConfig, mergeConfig } from "vitest/config";

import { sharedConfiguration } from "./vitest.shared.config.ts";

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
			// --fuzz-time is the per-target budget; a vitest timeout would cut it
			// short.
			testTimeout: 0,
			typecheck: { enabled: false },
		},
	}),
);

export default configuration;
