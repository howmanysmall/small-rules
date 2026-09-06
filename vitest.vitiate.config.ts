import { vitiatePlugin } from "@vitiate/core";
import { defineConfig, mergeConfig } from "vitest/config";

import { sharedConfiguration } from "./vitest.config.ts";

const configuration = mergeConfig(
	sharedConfiguration,
	defineConfig({
		plugins: [vitiatePlugin()],
		test: {
			coverage: { enabled: false },
			include: ["tests/**/*.fuzz.ts"],
			typecheck: { enabled: false },
		},
	}),
);

export default configuration;
