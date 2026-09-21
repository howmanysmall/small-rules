import { argv } from "node:process";
import { OpenRouter } from "@openrouter/sdk";
import { consola } from "consola";

import { createBaseCommand } from "$script-functions/create-base-command";
import { getScriptName } from "$script-functions/get-script-name";

const name = getScriptName(true);
const log = consola.withTag(name);

// oxlint-disable-next-line no-void -- temporary fix so I can commit.
void log;

const command = createBaseCommand(name, "1.0.0", 'Used to regenerate the "related lints" for the website.')
	.env("OPENROUTER_API_KEY=<api-key:string>", "The OpenRouter API key.", { required: true })
	.action(async ({ openrouterApiKey }) => {
		const openrouter = new OpenRouter({ apiKey: openrouterApiKey });
		await openrouter.alpha.decisions.create({
			decisionsRequest: {
				model: "~typesafe/jev-latest",
				questions: {
					is_bug: {
						criteria: { false: "...", true: "..." },
						instructions: "Is the customer reporting a software defect?",
						type: "noul",
					},
				},
				state: {
					ticket: "My checkout page shows a blank screen...",
				},
			},
		});
	});

await command.parse(argv.slice(2));
