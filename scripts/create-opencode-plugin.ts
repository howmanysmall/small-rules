#!/usr/bin/env bun

import { mkdir, writeFile } from "node:fs/promises";
import { argv, cwd } from "node:process";
import { existsAsync } from "@small-rules/fs-utilities";
import { dirname, join } from "@std/path";
import { consola } from "consola";
import { exec } from "tinyexec";

import { createBaseCommand } from "$script-functions/create-base-command";
import { getScriptName } from "$script-functions/get-script-name";
import { toCamelCase, toKebabCase } from "$script-utilities/casing-utilities";

import type { ArgumentValue } from "@cliffy/command";
import type { PackageJson } from "type-fest";

const scriptName = getScriptName(true);
const log = consola.withTag(scriptName);

function nameType({ value }: ArgumentValue): string {
	return toKebabCase(value);
}

const rootDirectory = join(cwd(), ".opencode");
const monorepoDirectory = join(rootDirectory, "packages", "plugins");
const pluginsDirectory = join(rootDirectory, "plugins");

async function safeCreateFileAsync(filePath: string, contents: string, forceOverwrite = false): Promise<boolean> {
	await mkdir(dirname(filePath), { recursive: true });

	if (!forceOverwrite) {
		const fileExists = await existsAsync(filePath);
		if (fileExists) return false;
	}

	await writeFile(filePath, contents, { encoding: "utf8" });
	return true;
}

function getPackageJson(name: string): PackageJson {
	// oxlint-disable perfectionist/sort-objects -- sensitive to order
	return {
		name: `@opencode-plugins/${name}`,
		private: true,
		type: "module",
		dependencies: {
			effect: "catalog:runtime",
		},
		devDependencies: {
			"@opencode-ai/plugin": "catalog:tooling",
		},
		peerDependencies: {
			"@opencode-ai/plugin": "catalog:tooling",
		},
	} satisfies PackageJson;
	// oxlint-enable perfectionist/sort-objects -- sensitive to order
}

function getPluginSource(name: string): string {
	const camelCase = toCamelCase(name);

	return `import { Plugin } from "@opencode-ai/plugin/effect";
import { Effect } from "effect";

import type { Scope } from "effect";

const ${camelCase} = Plugin.define({
	id: "${name}",
	effect(context): Effect.Effect<void, never, Scope.Scope> {
		return Effect.gen(function* effect() {
			// does nothing.
		});
	},
});

export default ${camelCase};
`;
}

async function createPluginAsync(name: string, forceOverwrite = false): Promise<void> {
	const pluginDirectory = join(monorepoDirectory, name);

	const packageJson = `${JSON.stringify(getPackageJson(name), undefined, "\t")}\n`;
	const booleans = await Promise.all([
		safeCreateFileAsync(join(pluginDirectory, "package.json"), packageJson, forceOverwrite),
		safeCreateFileAsync(join(pluginDirectory, "plugin", "index.ts"), getPluginSource(name), forceOverwrite),
		safeCreateFileAsync(
			join(pluginsDirectory, `${name}.ts`),
			`export { default } from "$plugins/${name}/plugin";
`,
			forceOverwrite,
		),
	]);

	if (booleans.includes(false)) return;
	log.info(`Plugin created successfully: ${name} (installing dependencies...)`);
	await exec("ni");
}

const command = createBaseCommand(scriptName, "1.0.0", "Scaffold a new OpenCode2 plugin.")
	.type("name", nameType)
	.option("-f, --force", "Force overwrite existing files.")
	.argument("<name:name>", "The name of the plugin to create.")
	.action(async ({ force }, name) => {
		log.info(`Creating plugin: ${name}`);
		await createPluginAsync(name, force);
	});

await command.parse(argv.slice(2));
