import { defineConfig, mergeConfig } from "vitest/config";

import { sharedConfiguration } from "../vitest.shared.config.ts";

export default mergeConfig(
	sharedConfiguration,
	defineConfig({
		base: "/small-rules/",
		test: {
			name: "documentation",
			clearMocks: true,
			environment: "jsdom",
			include: ["tests/unit/**/*.test.{ts,tsx}"],
			// Component tests share a jsdom document, so keep the isolation the
			// shared base turns off for the node suites.
			isolate: true,
			restoreMocks: true,
			setupFiles: ["./tests/unit/setup.ts"],
		},
	}),
);
