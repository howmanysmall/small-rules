#!/usr/bin/env nub

import { readFile } from "node:fs/promises";

import { createScriptCommand, parseScriptArgumentsAsync } from "$script-functions/create-script-command";
import { writeGeneratedFileAsync } from "$script-functions/write-generated-file";
import { renderNoticesMarkdown } from "$script-utilities/vendored-notices";

const { command, log } = createScriptCommand(
	"1.0.1",
	"Generates THIRD-PARTY-NOTICES.md from the vendored-component catalog.",
);

command
	.option("-o, --output <output-path:string>", "Generated Markdown output path.", {
		default: "THIRD-PARTY-NOTICES.md",
	})
	.option("--check", "Fail instead of writing when the file on disk is stale.")
	.action(async ({ check, output }) => {
		const generated = renderNoticesMarkdown();

		if (check === true) {
			const existing = await readFile(output, "utf8").catch(() => undefined);
			if (existing === generated) {
				log.info(`${output} is up to date.`);
				return;
			}

			throw new Error(
				`${output} is stale. Run \`node --run generate:third-party-notices\` and commit the result.`,
			);
		}

		await writeGeneratedFileAsync(output, generated, log);
	});

await parseScriptArgumentsAsync(command);
