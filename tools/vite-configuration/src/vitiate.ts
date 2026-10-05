import { vitiatePlugin } from "@vitiate/core";
import { mergeConfig } from "vitest/config";

import { sharedConfiguration } from "./shared";

export const vitiateConfiguration = mergeConfig(sharedConfiguration, {
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
});
