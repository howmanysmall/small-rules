#!/usr/bin/env nub

import { argv } from "node:process";
import { ValidationError } from "@cliffy/command";
import { consola } from "consola";

import { textDecoder } from "$script-constants/reused-classes";
import { createBaseCommand } from "$script-functions/create-base-command";
import { getScriptName } from "$script-functions/get-script-name";
import { parseClasses, renderCatalog } from "$script-utilities/roblox-yielding-members";

const name = getScriptName(true);
const log = consola.withTag(name);

const command = createBaseCommand(
	name,
	"1.0.1",
	"Generates the Roblox yielding-member catalog used by the no-async-in-system rule.",
)
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
		const { mkdir, writeFile } = await import("node:fs/promises");
		const { dirname } = await import("@std/path");
		await mkdir(dirname(output), { recursive: true });
		await writeFile(output, generated, "utf8");
		log.success(`Wrote ${generated.length} bytes to ${output}`);
	});

await command.parse(argv.slice(2));
