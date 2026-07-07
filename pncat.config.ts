import { defineConfig, mergeCatalogRules } from "pncat";

const configuration = defineConfig({
	agent: "pnpm",
	catalogRules: mergeCatalogRules([]),
	postRun: 'nr format "**/package.json" "**/pnpm-workspace.yaml"',
});

export default configuration;
