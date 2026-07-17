import { defineConfig, mergeCatalogRules } from "pncat";

const configuration = defineConfig({
	agent: "pnpm",
	catalogRules: mergeCatalogRules([]),
	postRun: 'nr lint --fix "**/pnpm-workspace.yaml" "**/package.json"',
});

export default configuration;
