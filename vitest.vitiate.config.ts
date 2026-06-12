import { vitiatePlugin } from "@vitiate/core";
import { defineConfig, mergeConfig } from "vitest/config";

import baseConfiguration from "./vitest.config";

const configuration = mergeConfig(
	baseConfiguration,
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
