import { sharedConfiguration } from "@small-rules/vite-configuration";
import { defineConfig, mergeConfig } from "vitest/config";

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
