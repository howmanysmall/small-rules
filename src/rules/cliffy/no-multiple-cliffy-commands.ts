import { isStringLiteral, isTemplateLiteral } from "@small-rules/oxlint-utilities";

import { COMMAND_MATCHER_SCHEMA, createCommandMatcher } from "$oxc-utilities/cliffy-command-matcher";
import { createRule } from "$oxc-utilities/create-rule";
import { getMethodCallee } from "$oxc-utilities/member-callee";

import type { ESTree, VisitorWithHooks } from "oxlint-plugin-utilities";

import type { CommandMatcher } from "$oxc-utilities/cliffy-command-matcher";

/**
 * Finds Cliffy's fluent form, `.command("name")` or
 * `.command("name", "description")`, which defines a subcommand on the spot.
 * A second argument that's anything else registers a command defined elsewhere.
 *
 * @param node - The call to inspect.
 * @param matcher - The file's command matcher.
 * @returns The `command` property to report, when the call defines a subcommand.
 */
function getInlineSubcommand(node: ESTree.CallExpression, matcher: CommandMatcher): ESTree.Node | undefined {
	const callee = getMethodCallee(node, "command");
	if (callee === undefined) return undefined;

	const [, description] = node.arguments;
	if (description !== undefined && !isStringLiteral(description) && !isTemplateLiteral(description)) return undefined;

	return matcher.isCommand(callee.object) ? callee.property : undefined;
}

const noMultipleCliffyCommands = createRule("no-multiple-cliffy-commands", "cliffy", {
	createOnce(context): VisitorWithHooks {
		let matcher: CommandMatcher;
		let firstCommandLine: number | undefined;

		function recordCommand(node: ESTree.Node): void {
			if (firstCommandLine === undefined) {
				firstCommandLine = node.loc.start.line;
				return;
			}

			context.report({
				data: { line: String(firstCommandLine) },
				messageId: "multipleCommands",
				node,
			});
		}

		function recordClass(node: ESTree.Class): void {
			if (matcher.isCommandClass(node)) {
				recordCommand(node.id ?? node);
			}
		}

		// Commands are recorded on exit so a builder chain's root comes before
		// the `.command` calls hanging off it, which keeps them in source order.
		return {
			before(): void {
				firstCommandLine = undefined;
				matcher = createCommandMatcher(context.sourceCode, context.options[0]?.factories);
			},
			"CallExpression:exit"(node): void {
				if (matcher.isConstruction(node)) {
					recordCommand(node.callee);
					return;
				}

				const subcommand = getInlineSubcommand(node, matcher);
				if (subcommand !== undefined) {
					recordCommand(subcommand);
				}
			},
			ClassDeclaration: recordClass,
			ClassExpression: recordClass,
			"NewExpression:exit"(node): void {
				if (matcher.isConstruction(node)) {
					recordCommand(node);
				}
			},
		} satisfies VisitorWithHooks;
	},
	meta: {
		docs: {
			description: "Disallow defining more than one Cliffy command in a file.",
		},
		messages: {
			multipleCommands:
				"This file already defines a Cliffy command on line {{line}}. Move this one to its own file, and have the parent load it with `.command(name, async () => ...)`.",
		},
		schema: COMMAND_MATCHER_SCHEMA,
		type: "suggestion",
	},
});

export default noMultipleCliffyCommands;
