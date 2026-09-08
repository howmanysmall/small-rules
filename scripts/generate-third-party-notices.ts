#!/usr/bin/env nub

import { readFile, writeFile } from "node:fs/promises";
import { argv } from "node:process";
import { consola } from "consola";

import { createBaseCommand } from "$script-functions/create-base-command";
import { getScriptName } from "$script-functions/get-script-name";
import { renderNoticesMarkdown } from "$script-utilities/vendored-notices";

const name = getScriptName(true);
const log = consola.withTag(name);

const command = createBaseCommand(
	name,
	"1.0.1",
	"Generates THIRD-PARTY-NOTICES.md from the vendored-component catalog.",
)
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

		await writeFile(output, generated, "utf8");
		log.success(`Wrote ${generated.length} bytes to ${output}`);
	});

await command.parse(argv.slice(2));
