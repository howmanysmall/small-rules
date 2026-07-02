import { defineConfig, mergeCatalogRules } from "pncat";

const configuration = defineConfig({
	catalogRules: mergeCatalogRules([]),
	postRun: 'biome check --fix "**/package.json" "**/pnpm-workspace.yaml"',
});

export default configuration;
