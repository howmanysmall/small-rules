import { defineConfig } from "vitest/config";

export default defineConfig({
	base: "/small-rules/",
	resolve: {
		tsconfigPaths: true,
	},
	test: {
		clearMocks: true,
		environment: "jsdom",
		include: ["tests/unit/**/*.test.tsx"],
		restoreMocks: true,
		setupFiles: ["./tests/unit/setup.ts"],
	},
});
