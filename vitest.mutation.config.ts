import { defineConfig, mergeConfig } from "vitest/config";

import baseConfiguration from "./vitest.config";

const configuration = mergeConfig(
	baseConfiguration,
	defineConfig({
		test: {
			coverage: { enabled: false },
			typecheck: { enabled: false },
		},
	}),
);

export default configuration;
