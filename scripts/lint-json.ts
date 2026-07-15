#!/usr/bin/env nub

import { resolve } from "node:path";
import { exit, argv } from "node:process";
import { $ } from "zx";

const repositoryRoot = resolve(import.meta.dirname, "..");

function getLintArguments(parameters: ReadonlyArray<string>): ReadonlyArray<string> {
	const flags = new Array<string>();
	const paths = new Array<string>();

	for (const parameter of parameters) {
		if (parameter.startsWith("-")) flags.push(parameter);
		else paths.push(parameter);
	}

	return [...flags, ...(paths.length === 0 ? ["."] : paths)];
}

interface JsonResult {
	readonly exitCode: number;
	readonly output: unknown;
}

async function runJsonAsync(command: string, parameters: ReadonlyArray<string>): Promise<JsonResult> {
	try {
		const { stdout, exitCode } = await $({ cwd: repositoryRoot })`${[command, ...parameters]}`.nothrow().quiet();

		const output = stdout.trim();
		if (output.length === 0) {
			const error = new Error(`${command} did not print JSON output`);
			Error.captureStackTrace(error, runJsonAsync);
			throw error;
		}

		try {
			return {
				exitCode: exitCode ?? 0,
				output: JSON.parse(output),
			};
		} catch (error) {
			const exception = new Error(
				`Failed to parse ${command} JSON output: ${error instanceof Error ? error.message : String(error)}\n${output}`,
				{ cause: error },
			);
			Error.captureStackTrace(exception, runJsonAsync);
			throw exception;
		}
		// oxlint-disable-next-line no-useless-catch sonar/no-useless-catch -- not useless.
	} catch (error) {
		throw error;
	}
}

const lintArguments = getLintArguments(argv.slice(2));
const oxlintResult = await runJsonAsync("oxlint", ["--format", "json", ...lintArguments]);
const biomeResult = await runJsonAsync("biome", ["check", "--reporter", "json", ...lintArguments]);

console.log(JSON.stringify({ biome: biomeResult.output, oxlint: oxlintResult.output }));
exit(Math.max(oxlintResult.exitCode, biomeResult.exitCode));
