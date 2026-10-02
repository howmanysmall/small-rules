import { sharedConfiguration } from "@small-rules/vite-configuration";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
	sharedConfiguration,
	defineConfig({
		test: {
			name: "release-notes",
			include: ["src/**/*.test.ts"],
			testTimeout: 5_000,
		},
	}),
);
