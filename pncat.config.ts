import { defineConfig, mergeCatalogRules } from "pncat";

const configuration = defineConfig({
	agent: "pnpm",
	catalogRules: mergeCatalogRules([]),
	postRun: 'node --run isentinel-lint -- --eslint "**/pnpm-workspace.yaml" "**/package.json"',
});

export default configuration;
