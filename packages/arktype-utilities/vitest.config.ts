import { defineConfig } from "vitest/config";

const configuration = defineConfig({
	resolve: { tsconfigPaths: true },
	test: {
		name: "arktype-utilities",
		environment: "node",
		globals: true,
		include: ["src/**/*.test.ts"],
		isolate: false,
		pool: "forks",
		testTimeout: 5_000,
	},
});

export default configuration;
