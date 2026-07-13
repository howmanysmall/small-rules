#!/usr/bin/env nub

import { argv } from "node:process";
import { textDecoder } from "$script-constants/reused-classes";
import { parseClasses, renderCatalog } from "$script-utilities/roblox-yielding-members";
import { Command } from "@cliffy/command";

const command = new Command()
	.name("generate-roblox-yielding-members")
	.version("1.0.0")
	.description("Generates the Roblox yielding-member catalog used by the no-async-in-system rule.")
	.env("GITHUB_TOKEN=<value:string>", "The GitHub token environment variable.", { required: false })
	.env("GITHUB_PAT=<value:string>", "Alternative GitHub token environment variable.", { required: false })
	.env("GITHUB_PERSONAL_ACCESS_TOKEN=<value:string>", "Alternative GitHub token environment variable.", {
		required: false,
	})
	.option("--file-path <file-path:file>", "Use a local Roblox API-Dump.json instead of the latest upstream dump.")
	.option("-o, --output <output-path:string>", "Generated TypeScript output path.", {
		default: "src/generated/roblox-yielding-members.ts",
	})
	.action(async ({ filePath, githubPat, githubPersonalAccessToken, githubToken, output }) => {
		let bytes: Uint8Array;
		if (filePath === undefined) {
			const { Octokit } = await import("@octokit/rest");
			const { downloadGitHubFileAsync } = await import("$script-utilities/github-utilities");
			const octokit = new Octokit({ auth: githubToken ?? githubPat ?? githubPersonalAccessToken });
			bytes = await downloadGitHubFileAsync(octokit, {
				owner: "MaximumADHD",
				path: "API-Dump.json",
				repository: "Roblox-Client-Tracker",
			});
		} else {
			const { readFile } = await import("node:fs/promises");
			bytes = await readFile(filePath);
		}

		const json = JSON.parse(textDecoder.decode(bytes));
		const generated = renderCatalog(parseClasses(json));
		const { mkdir, writeFile } = await import("node:fs/promises");
		const { dirname } = await import("node:path");
		await mkdir(dirname(output), { recursive: true });
		await writeFile(output, generated, "utf8");
		console.log(`Wrote ${generated.length} bytes to ${output}`);
	});

await command.parse(argv.slice(2));
