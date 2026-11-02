import { describe } from "vitest";
import { ts } from "@small-rules/rule-harness/rule-testers";

import rule from "$oxc-rules/general/no-cliffy-action-wrapper";

const IMPORT_COMMAND = 'import { Command } from "@cliffy/command";';
const DECLARE_RUN = "function run(...values) {}";

const FORWARDING_HANDLERS: ReadonlyArray<string> = [
	// Every shape a one-call handler can take.
	"(flags) => run(flags)",
	"async (flags) => run(flags)",
	"async (flags) => await run(flags)",
	"(flags) => void run(flags)",
	"(flags) => { run(flags); }",
	"async (flags) => { await run(flags); }",
	"(flags) => { return run(flags); }",
	"async (flags) => { return await run(flags); }",
	"(flags) => { void run(flags); }",
	"function (flags) { run(flags); }",
	"() => run()",
	// Every way the arguments can be handed along.
	"(flags, search) => run(search, flags)",
	"(flags, ...models) => run(models, flags)",
	"(flags, ...models) => run(flags, ...models)",
	"({ json, refresh }, search) => run(search, { json, refresh })",
	"({ json: asJson }) => run(asJson)",
	"({ json = false }) => run(json)",
	"({ json, ...others }) => run(json, others)",
	"(flags = {}) => run(flags)",
	"(flags, [, second]) => run(flags, second)",
	"(flags) => run(flags.json, flags.limit)",
	"(flags) => run(flags?.json)",
	"(flags) => run({ ...flags, json: flags.json })",
	"(flags, search) => run([flags, search])",
	"(flags, search) => run([flags, ...search])",
	"(flags) => run(flags as Flags)",
	"(flags) => run(flags!)",
];

/**
 * Wraps a handler in a recognized Cliffy command with a local `run` to forward
 * to.
 *
 * @param handler - The handler's source text.
 * @returns The program source.
 */
function createProgram(handler: string): string {
	return [IMPORT_COMMAND, DECLARE_RUN, `new Command().action(${handler});`].join("\n");
}

describe("no-cliffy-action-wrapper", () => {
	ts.run("no-cliffy-action-wrapper", rule, {
		invalid: [
			{
				code: [
					'import { createBaseCommand } from "@bin/cli/base-command";',
					"",
					"async function runGetAsync(references, { json, refresh }) {",
					"\tconst models = await loadModelsAsync(references, refresh);",
					"\tprintModels(models, json);",
					"}",
					"",
					'export const getCommand = createBaseCommand("get", undefined, "Get models.")',
					'\t.arguments("<model...:model>")',
					"\t.action(async (flags, ...models) => {",
					"\t\tawait runGetAsync(models, flags);",
					"\t});",
				].join("\n"),
				errors: [{ data: { name: "runGetAsync" }, line: 10, messageId: "actionWrapper" }],
				documentation: { id: "fail", title: "A handler that only forwards to a function" },
			},
			...FORWARDING_HANDLERS.map((handler) => ({
				code: createProgram(handler),
				errors: [{ data: { name: "run" }, messageId: "actionWrapper" as const }],
			})),
			// Catches the wrapper when the target isn't a function declaration.
			{
				code: [
					IMPORT_COMMAND,
					"const run = (flags) => {};",
					"new Command().action((flags) => run(flags));",
				].join("\n"),
				errors: [{ messageId: "actionWrapper" }],
			},
			// Catches the wrapper when the implementation lives in another file.
			{
				code: [
					IMPORT_COMMAND,
					'import { run } from "./run";',
					"new Command().action((flags) => run(flags));",
				].join("\n"),
				errors: [{ messageId: "actionWrapper" }],
			},
			// Catches the wrapper partway down a builder chain.
			{
				code: [
					IMPORT_COMMAND,
					DECLARE_RUN,
					"new Command()",
					'\t.option("--json", "Print JSON.")',
					'\t.command("list", "List things.")',
					"\t.action((flags) => run(flags));",
				].join("\n"),
				errors: [{ line: 6, messageId: "actionWrapper" }],
			},
			{
				code: [
					DECLARE_RUN,
					'createBaseCommand("list", undefined, "List things.").action((flags, search) => run(flags, search));',
				].join("\n"),
				errors: [{ messageId: "actionWrapper" }],
			},
			{
				code: [DECLARE_RUN, 'makeCommand("list").action((flags) => run(flags));'].join("\n"),
				options: [{ factories: ["makeCommand"] }],
				errors: [{ messageId: "actionWrapper" }],
			},
			// Catches a command built before `.action` is attached.
			{
				code: [
					IMPORT_COMMAND,
					DECLARE_RUN,
					"const command = new Command();",
					"const alias = command;",
					"alias.action((flags) => run(flags));",
				].join("\n"),
				errors: [{ messageId: "actionWrapper" }],
			},
		],
		valid: [
			{
				code: [
					'import { createBaseCommand } from "@bin/cli/base-command";',
					"",
					'export const getCommand = createBaseCommand("get", undefined, "Get models.")',
					'\t.arguments("<model...:model>")',
					"\t.action(async ({ json, refresh }, ...references) => {",
					"\t\tconst models = await loadModelsAsync(references, refresh);",
					"\t\tprintModels(models, json);",
					"\t});",
				].join("\n"),
				documentation: { id: "pass", title: "The implementation lives in the handler" },
			},
			// Lazy loading is real work, not a wrapper.
			createProgram('async (flags) => { const { load } = await import("./load"); await load(flags); }'),
			// A bare reference has no wrapper to remove.
			createProgram("run"),
			createProgram("() => {}"),
			createProgram("() => 1"),
			createProgram("() => { return; }"),
			createProgram("(flags) => { flags; }"),
			createProgram("(flags) => { if (flags.json) run(flags); }"),
			// Printing is the whole command; there's no function worth inlining.
			createProgram("(options) => console.log(options)"),
			createProgram("function () { this.showHelp(); }"),
			createProgram("(flags) => getRun()(flags)"),
			// Fixed or outside values mean the call isn't only forwarding.
			createProgram("() => run(0)"),
			createProgram('(flags) => run(flags, "list")'),
			createProgram("(flags) => run(flags, config)"),
			createProgram("(flags) => run(config.json)"),
			createProgram("(flags) => run(flags[key])"),
			createProgram("(flags) => run({ [key]: flags })"),
			createProgram("(flags) => run({ json() {} })"),
			createProgram("(flags) => run([, flags])"),
			createProgram("(flags) => run?.(flags)"),
			// The target has to be something this file can inline or import.
			createProgram("(flags) => print(flags)"),
			createProgram("({ run }) => run()"),
			[IMPORT_COMMAND, "function configure(run) {", "\tnew Command().action((flags) => run(flags));", "}"].join(
				"\n",
			),
			// Only Cliffy's `.action` is in scope.
			[DECLARE_RUN, "program.action((flags) => run(flags));"].join("\n"),
			['import { Command } from "commander";', DECLARE_RUN, "new Command().action((flags) => run(flags));"].join(
				"\n",
			),
			[DECLARE_RUN, "this.action((flags) => run(flags));"].join("\n"),
			{
				code: [DECLARE_RUN, 'createBaseCommand("list").action((flags) => run(flags));'].join("\n"),
				options: [{ factories: [] }],
			},
			// Malformed calls must not crash the rule.
			[IMPORT_COMMAND, "new Command().action();"].join("\n"),
			[IMPORT_COMMAND, "new Command().action(...handlers);"].join("\n"),
			[IMPORT_COMMAND, DECLARE_RUN, "new Command().name((flags) => run(flags));"].join("\n"),
		],
	});
});
