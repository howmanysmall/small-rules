import { defineConfig, mergeConfig } from "vitest/config";

import { sharedConfiguration } from "../../vitest.shared.config.ts";

const configuration = mergeConfig(
	sharedConfiguration,
	defineConfig({
		test: {
			name: "fs-utilities",
			include: ["src/**/*.test.ts"],
			testTimeout: 5_000,
		},
	}),
);

export default configuration;
