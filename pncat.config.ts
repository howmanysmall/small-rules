import { defineConfig, mergeCatalogRules } from "pncat";

const configuration = defineConfig({
	agent: "pnpm",
	catalogRules: mergeCatalogRules([]),
	postRun: 'node --run oxfmt -- "**/pnpm-workspace.yaml" "**/package.json"',
});

export default configuration;
