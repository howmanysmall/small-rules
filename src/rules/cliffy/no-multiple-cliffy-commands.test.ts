import { describe } from "vitest";
import { ts } from "@small-rules/rule-harness/rule-testers";

import rule from "$oxc-rules/cliffy/no-multiple-cliffy-commands";

const IMPORT_COMMAND = 'import { Command } from "@cliffy/command";';

describe("no-multiple-cliffy-commands", () => {
	ts.run("no-multiple-cliffy-commands", rule, {
		invalid: [
			{
				code: [
					'import { createBaseCommand } from "@bin/cli/base-command";',
					"",
					'const listCommand = createBaseCommand("list", undefined, "List LLMs.").action(() => {});',
					'const getCommand = createBaseCommand("get", undefined, "Get LLMs.").action(() => {});',
					"",
					'export const llmsCommand = createBaseCommand("llms", undefined, "Query LLMs.")',
					'\t.command("list", listCommand)',
					'\t.command("get", getCommand);',
				].join("\n"),
				errors: [
					{ data: { line: "3" }, line: 4, messageId: "multipleCommands" },
					{ data: { line: "3" }, line: 6, messageId: "multipleCommands" },
				],
				documentation: { id: "fail", title: "A command and its subcommands in one file" },
			},
			{
				code: [
					IMPORT_COMMAND,
					"export const first = new Command();",
					"export const second = new Command();",
				].join("\n"),
				errors: [{ data: { line: "2" }, line: 3, messageId: "multipleCommands" }],
			},
			// Catches a renamed import hiding the second command.
			{
				code: [
					'import { Command as CliffyCommand } from "@cliffy/command";',
					"new CliffyCommand();",
					"new CliffyCommand();",
				].join("\n"),
				errors: [{ line: 3, messageId: "multipleCommands" }],
			},
			{
				code: [
					'import * as cliffy from "@cliffy/command";',
					"new cliffy.Command();",
					"new cliffy.Command();",
				].join("\n"),
				errors: [{ line: 3, messageId: "multipleCommands" }],
			},
			// Catches a Deno script or a JSR-over-npm install escaping the rule.
			{
				code: [
					'import { Command } from "jsr:@cliffy/command@^1.0.0";',
					"new Command();",
					"new Command();",
				].join("\n"),
				errors: [{ messageId: "multipleCommands" }],
			},
			{
				code: ['import { Command } from "@jsr/cliffy__command";', "new Command();", "new Command();"].join(
					"\n",
				),
				errors: [{ messageId: "multipleCommands" }],
			},
			{
				code: [
					'import { Command } from "npm:@jsr/cliffy__command@1.3.1";',
					"new Command();",
					"new Command();",
				].join("\n"),
				errors: [{ messageId: "multipleCommands" }],
			},
			// Catches a subcommand hiding as an argument of its parent.
			{
				code: [IMPORT_COMMAND, "new Command()", '\t.command("list", new Command());'].join("\n"),
				errors: [{ data: { line: "2" }, line: 3, messageId: "multipleCommands" }],
			},
			// Catches the fluent form: several commands from one `new Command()`.
			{
				code: [
					IMPORT_COMMAND,
					"new Command()",
					'\t.command("list", "List things.")',
					"\t.action(() => {})",
					'\t.command("get")',
					"\t.action(() => {});",
				].join("\n"),
				errors: [
					{ data: { line: "2" }, line: 3, messageId: "multipleCommands" },
					{ data: { line: "2" }, line: 5, messageId: "multipleCommands" },
				],
			},
			{
				code: [IMPORT_COMMAND, "new Command().command(`list`, `List things.`);"].join("\n"),
				errors: [{ messageId: "multipleCommands" }],
			},
			// Catches the fluent form on a parent held in a variable.
			{
				code: [
					IMPORT_COMMAND,
					"const root = new Command();",
					"const alias = root;",
					'alias.command("list", "List things.");',
				].join("\n"),
				errors: [{ data: { line: "2" }, line: 4, messageId: "multipleCommands" }],
			},
			{
				code: [
					IMPORT_COMMAND,
					"export class ListCommand extends Command {}",
					"export const GetCommand = class extends Command {};",
				].join("\n"),
				errors: [{ data: { line: "2" }, line: 3, messageId: "multipleCommands" }],
			},
			{
				code: [IMPORT_COMMAND, "class ListCommand extends Command {", "\troot = new Command();", "}"].join(
					"\n",
				),
				errors: [{ data: { line: "2" }, line: 3, messageId: "multipleCommands" }],
			},
			// Catches a project whose factory isn't called createBaseCommand.
			{
				code: ['makeCommand("list");', 'makeCommand("get");'].join("\n"),
				options: [{ factories: ["makeCommand"] }],
				errors: [{ data: { line: "1" }, line: 2, messageId: "multipleCommands" }],
			},
			// Catches a file that mixes both ways of building a command.
			{
				code: [IMPORT_COMMAND, "new Command();", 'createBaseCommand("list", undefined, "List things.");'].join(
					"\n",
				),
				errors: [{ data: { line: "2" }, line: 3, messageId: "multipleCommands" }],
			},
		],
		valid: [
			{
				code: [
					'import { createBaseCommand } from "@bin/cli/base-command";',
					"",
					'export const llmsCommand = createBaseCommand("llms", undefined, "Query LLMs.")',
					'\t.command("list", async () => {',
					'\t\tconst { listCommand } = await import("./commands/list-command");',
					"\t\treturn listCommand;",
					"\t})",
					'\t.command("get", async () => {',
					'\t\tconst { getCommand } = await import("./commands/get-command");',
					"\t\treturn getCommand;",
					"\t});",
				].join("\n"),
				documentation: { id: "pass", title: "One command that loads its subcommands from their own files" },
			},
			[IMPORT_COMMAND, "export const command = new Command().action(() => {});"].join("\n"),
			// Cliffy's built-in commands are registered, not defined here.
			[
				IMPORT_COMMAND,
				'import { HelpCommand } from "@cliffy/command/help";',
				'new Command().command("help", new HelpCommand());',
			].join("\n"),
			[
				IMPORT_COMMAND,
				'import { listCommand } from "./list-command";',
				'new Command().command("list", listCommand);',
			].join("\n"),
			// Another library's Command is not a Cliffy command.
			['import { Command } from "commander";', "new Command();", "new Command();"].join("\n"),
			["class Command {}", "new Command();", "new Command();"].join("\n"),
			[
				'import { Command } from "commander";',
				"class First extends Command {}",
				"class Second extends Command {}",
			].join("\n"),
			// Commander's `.command` looks alike; only a known receiver counts.
			['program.command("list", "List things.");', 'program.command("get", "Get things.");'].join("\n"),
			[
				'import { Command } from "commander";',
				"const program = new Command();",
				'program.command("list", "List things.");',
			].join("\n"),
			[IMPORT_COMMAND, "class Plain {}", "class Other extends Base {}", "new Command();"].join("\n"),
			[IMPORT_COMMAND, "new Command();", 'getRoot().command("list", "List things.");'].join("\n"),
			[IMPORT_COMMAND, "const root = new Command();", 'root?.command("list", "List things.");'].join("\n"),
			// A reassignable variable isn't provably the command it started as.
			[IMPORT_COMMAND, "let root = new Command();", 'root.command("list", "List things.");'].join("\n"),
			// A self-referential initializer must not hang the rule.
			['const root = root.name("x");', 'root.command("list", "List things.");'].join("\n"),
			['createBaseCommand("list");', 'getFactories().createBaseCommand("get");', "factory()();"].join("\n"),
			{
				code: ['createBaseCommand("list");', 'createBaseCommand("get");'].join("\n"),
				options: [{ factories: [] }],
			},
		],
	});
});
