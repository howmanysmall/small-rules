import { defineConfig } from "bumpp";

const configuration = defineConfig({
	commit: true,
	confirm: true,
	noGitCheck: false,
	push: true,
	tag: true,
});

export default configuration;
