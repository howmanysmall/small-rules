#!/usr/bin/env bun

import { resolve } from "node:path";
import { cwd } from "node:process";
import { editJsonc } from "$script-utilities/jsonc-utilities";
import { Command } from "@cliffy/command";
import { type } from "arktype";
import { argv, JSONC, file, write } from "bun";
import { fdir } from "fdir";
import { create } from "mutative";

const fdirZed = new fdir().glob("**/.zed/settings.json").withFullPaths();

const isZedSettingsJson = type({
	"[string]": "unknown",
	"language_servers?": type("string[]").readonly().or("undefined"),
	"languages?": type
		.Record(
			"string",
			type({
				"[string]": "unknown",
				"language_servers?": type("string[]").readonly().or("undefined"),
			}).readonly(),
		)
		.readonly()
		.or("undefined"),
}).readonly();

function notTsgo(value: string): boolean {
	return value !== "tsgo";
}

const isSettingsJson = type({
	content: "string",
	filePath: "string",
}).readonly();
type SettingsJson = typeof isSettingsJson.infer;

async function getSettingsJsonAsync(filePath: string): Promise<SettingsJson | undefined> {
	try {
		const content = await file(filePath).text();
		if (!content.includes('"tsgo"')) return undefined;

		const zedSettings = JSONC.parse(content);
		return isZedSettingsJson.allows(zedSettings) ? { content, filePath } : undefined;
	} catch {
		return undefined;
	}
}
async function getSettingsJsonsAsync(settingsPaths: ReadonlyArray<string>): Promise<ReadonlyArray<SettingsJson>> {
	const results = await Promise.all(settingsPaths.map(getSettingsJsonAsync));
	return results.filter((value): value is SettingsJson => value !== undefined);
}

const command = new Command()
	.name("disable-tsgo")
	.description("Disables the extremely broken and terrible `tsgo` language server in Zed settings.")
	.version("0.1.0")
	.argument("<scan-from:string>", "Where to start your scan from.", { default: cwd() })
	.action(async (_, scanFrom) => {
		const settingsPaths = await fdirZed.crawl(resolve(scanFrom)).withPromise();
		const settingsJsons = await getSettingsJsonsAsync(settingsPaths);

		await Promise.all(
			settingsJsons.map(async ({ content, filePath }) => {
				const updatedContents = editJsonc(content, isZedSettingsJson.assert, (zedSettings) =>
					create(zedSettings, (draft) => {
						if (draft.language_servers !== undefined) {
							draft.language_servers = draft.language_servers.filter(notTsgo);
						}

						const { languages } = draft;
						if (languages) {
							for (const language of Object.values(languages)) {
								language.language_servers = language.language_servers?.filter(notTsgo);
							}
						}

						return draft;
					}),
				);
				if (updatedContents !== content) await write(filePath, updatedContents);
			}),
		);
	});

await command.parse(argv.slice(2));
