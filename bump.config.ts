import { defineConfig } from "bumpp";

const configuration = defineConfig({
	all: true,
	commit: true,
	confirm: true,
	execute: "node --run changelog:version",
	noGitCheck: false,
	push: true,
	tag: true,
});

export default configuration;
