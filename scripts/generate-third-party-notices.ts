#!/usr/bin/env nub

import { readFile, writeFile } from "node:fs/promises";
import { argv } from "node:process";
import { Command } from "@cliffy/command";

import { renderNoticesMarkdown } from "$script-utilities/vendored-notices";

const command = new Command()
	.name("generate-third-party-notices")
	.version("1.0.0")
	.description("Generates THIRD-PARTY-NOTICES.md from the vendored-component catalog.")
	.option("-o, --output <output-path:string>", "Generated Markdown output path.", {
		default: "THIRD-PARTY-NOTICES.md",
	})
	.option("--check", "Fail instead of writing when the file on disk is stale.")
	.action(async ({ check, output }) => {
		const generated = renderNoticesMarkdown();

		if (check === true) {
			const existing = await readFile(output, "utf8").catch(() => undefined);
			if (existing === generated) {
				console.log(`${output} is up to date.`);
				return;
			}

			throw new Error(
				`${output} is stale. Run \`node --run generate:third-party-notices\` and commit the result.`,
			);
		}

		await writeFile(output, generated, "utf8");
		console.log(`Wrote ${generated.length} bytes to ${output}`);
	});

await command.parse(argv.slice(2));
