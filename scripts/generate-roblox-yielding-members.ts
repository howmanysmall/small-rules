#!/usr/bin/env nub

import { ValidationError } from "@cliffy/command";

import { textDecoder } from "$script-constants/reused-classes";
import { createScriptCommand, parseScriptArgumentsAsync } from "$script-functions/create-script-command";
import { writeGeneratedFileAsync } from "$script-functions/write-generated-file";
import { parseClasses, renderCatalog } from "$script-utilities/roblox-yielding-members";

const { command, log } = createScriptCommand(
	"1.0.1",
	"Generates the Roblox yielding-member catalog used by the no-async-in-system rule.",
);

command
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
			const octokit = new Octokit({ auth: githubToken ?? githubPat ?? githubPersonalAccessToken });
			const repository = await octokit.rest.repos.get({ owner: "MaximumADHD", repo: "Roblox-Client-Tracker" });
			const branch = encodeURIComponent(repository.data.default_branch);
			const response = await fetch(
				`https://raw.githubusercontent.com/MaximumADHD/Roblox-Client-Tracker/${branch}/API-Dump.json`,
			);
			if (!response.ok) throw new ValidationError(`Failed to download Roblox API dump: ${response.statusText}`);
			bytes = new Uint8Array(await response.arrayBuffer());
		} else {
			const { readFile } = await import("node:fs/promises");
			bytes = await readFile(filePath);
		}

		const json = JSON.parse(textDecoder.decode(bytes));
		const generated = renderCatalog(parseClasses(json));
		await writeGeneratedFileAsync(output, generated, log);
	});

await parseScriptArgumentsAsync(command);
