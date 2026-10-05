import { sharedConfiguration } from "@small-rules/vite-configuration";
import { mergeConfig } from "vitest/config";

const configuration = mergeConfig(sharedConfiguration, {
	test: {
		name: "rule-tester",
		include: ["src/**/*.test.ts"],
		testTimeout: 5_000,
	},
});

export default configuration;
