#!/usr/bin/env nub

import { argv } from "node:process";
import { consola } from "consola";
import { complete, programming } from "verb-corpus";

import { createBaseCommand } from "$script-functions/create-base-command";
import { getScriptName } from "$script-functions/get-script-name";
import { getCandidateWords, isPrimarilyVerb, renderDictionaryVerbs } from "$script-utilities/dictionary-verbs";

const name = getScriptName(true);
const log = consola.withTag(name);

async function isDatamuseVerbAsync(word: string): Promise<boolean> {
	const response = await fetch(`https://api.datamuse.com/words?sp=${word}&qe=sp&md=p&max=1`);
	if (!response.ok) throw new Error(`Datamuse request for "${word}" failed: ${response.statusText}`);
	return isPrimarilyVerb(await response.json(), word);
}

const command = createBaseCommand(
	name,
	"1.0.0",
	"Generates the verb list used by the starts-with-verb rule from verb-corpus and Datamuse.",
)
	.option("-c, --concurrency <concurrency:integer>", "Concurrent Datamuse requests.", { default: 16 })
	.option("-o, --output <output-path:string>", "Generated TypeScript output path.", {
		default: "src/generated/dictionary-verbs.ts",
	})
	.action(async ({ concurrency, output }) => {
		const candidates = getCandidateWords(complete, programming);
		const verbs = [...programming];

		let next = 0;
		async function drainQueueAsync(): Promise<void> {
			while (next < candidates.length) {
				const word = candidates[next];
				next += 1;
				// oxlint-disable-next-line no-await-in-loop -- each worker drains the shared queue one request at a time
				if (word !== undefined && (await isDatamuseVerbAsync(word))) verbs.push(word);
			}
		}
		await Promise.all(Array.from({ length: concurrency }, drainQueueAsync));

		const generated = renderDictionaryVerbs(verbs);
		const { writeFile } = await import("node:fs/promises");
		await writeFile(output, generated, "utf8");
		log.success(`Wrote ${verbs.length} verbs (${generated.length} bytes) to ${output}`);
	});

await command.parse(argv.slice(2));
