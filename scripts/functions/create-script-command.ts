import { argv } from "node:process";
import { consola } from "consola";

import { createBaseCommand } from "$script-functions/create-base-command";
import { getScriptName } from "$script-functions/get-script-name";

import type { Command } from "@cliffy/command";
import type { ConsolaInstance } from "consola";

export interface ScriptCommand {
	readonly command: Command;
	readonly log: ConsolaInstance;
}

/**
 * Creates the base command for the running script, named and tagged after the
 * script file.
 *
 * @param version - Shown by `--version`.
 * @param description - Shown at the top of `--help`.
 * @returns The command and a logger tagged with the script name.
 */
export function createScriptCommand(version: string, description: string): ScriptCommand {
	const name = getScriptName(true);
	return { command: createBaseCommand(name, version, description), log: consola.withTag(name) };
}

export async function parseScriptArgumentsAsync(command: Command): Promise<void> {
	await command.parse(argv.slice(2));
}
