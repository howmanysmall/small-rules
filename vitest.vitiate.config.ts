import { vitiatePlugin } from "@vitiate/core";
import { defineConfig } from "vitest/config";

const configuration = defineConfig({
	plugins: [vitiatePlugin()],
	resolve: { tsconfigPaths: true },
	test: {
		coverage: { enabled: false },
		environment: "node",
		include: ["tests/**/*.fuzz.ts"],
		testTimeout: 30_000,
		typecheck: { enabled: false },
	},
});

export default configuration;
