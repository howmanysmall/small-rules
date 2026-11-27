import { execFileSync } from "node:child_process";
import { defineConfig } from "bumpp";

const configuration = defineConfig({
	commit: true,
	confirm: true,
	execute(operation) {
		execFileSync("node", ["--run", "changelog:version"], { stdio: "inherit" });
		// bumpp only commits the files it knows it updated.
		operation.update({ updatedFiles: [...operation.state.updatedFiles, "CHANGELOG.md"] });
	},
	noGitCheck: false,
	push: true,
	tag: true,
});

export default configuration;
