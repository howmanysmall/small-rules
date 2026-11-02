import {
	isCallExpression,
	isIdentifier,
	isImportDeclaration,
	isMemberExpression,
	isNewExpression,
} from "@small-rules/oxlint-utilities";

import { getReferencedVariable } from "$oxc-utilities/ast-utilities";
import { isImportedCallee } from "$oxc-utilities/import-binding-provenance";
import { stripExpressionWrappers } from "$oxc-utilities/oxc-utilities";
import { getSingleConstInitializer } from "$oxc-utilities/single-variable-definition";

import type { ESTree, SourceCode } from "oxlint-plugin-utilities";

/** Tells which expressions in one file are Cliffy commands. */
export interface CommandMatcher {
	/**
	 * Whether `expression` evaluates to a command: a construction, a builder
	 * chain on one, or a `const` holding one.
	 */
	readonly isCommand: (expression: ESTree.Expression) => boolean;
	/** Whether `node` is a class that extends Cliffy's `Command`. */
	readonly isCommandClass: (node: ESTree.Class) => boolean;
	/**
	 * Whether `expression` builds a new command: `new Command()` or a factory
	 * call.
	 */
	readonly isConstruction: (expression: ESTree.Expression) => boolean;
}

const DEFAULT_COMMAND_FACTORIES: ReadonlyArray<string> = ["createBaseCommand"];

/** The `meta.schema` of every rule that uses a `CommandMatcher`. */
export const COMMAND_MATCHER_SCHEMA = [
	{
		additionalProperties: false,
		default: { factories: DEFAULT_COMMAND_FACTORIES },
		properties: {
			factories: {
				default: DEFAULT_COMMAND_FACTORIES,
				description:
					"Names of functions that return a new Cliffy command. A call counts by name wherever the function is imported from.",
				items: { type: "string" },
				type: "array",
			},
		},
		type: "object",
	},
] as const;

// Covers a bare specifier, Deno's `jsr:` form, and JSR's npm mirror, any of
// them pinned to a version.
const CLIFFY_COMMAND_SOURCE = /^(?:jsr:|npm:)?@(?:cliffy\/|jsr\/cliffy__)command(?:@[^/]+)?$/u;
const COMMAND_CLASS = "Command";
const MAX_ALIAS_HOPS = 8;

function getCliffySources({ ast }: SourceCode): ReadonlySet<string> {
	const sources = new Set<string>();
	for (const statement of ast.body) {
		if (isImportDeclaration(statement) && CLIFFY_COMMAND_SOURCE.test(statement.source.value)) {
			sources.add(statement.source.value);
		}
	}

	return sources;
}

/**
 * Builds the matcher for one file.
 *
 * @param sourceCode - Resolves imports and `const` bindings.
 * @param factoryNames - Functions that return a new command, from the rule's
 *   `factories` option.
 * @returns A matcher that's only valid for this file.
 */
export function createCommandMatcher(
	sourceCode: SourceCode,
	factoryNames: ReadonlyArray<string> = DEFAULT_COMMAND_FACTORIES,
): CommandMatcher {
	const factories: ReadonlySet<string> = new Set(factoryNames);
	const sources = getCliffySources(sourceCode);

	function isCommandClassReference(expression: ESTree.Expression): boolean {
		return isImportedCallee(sourceCode, stripExpressionWrappers(expression), sources, COMMAND_CLASS);
	}

	function isConstruction(expression: ESTree.Expression): boolean {
		if (isNewExpression(expression)) return isCommandClassReference(expression.callee);
		return isCallExpression(expression) && isIdentifier(expression.callee) && factories.has(expression.callee.name);
	}

	function isCommand(expression: ESTree.Expression): boolean {
		let current = stripExpressionWrappers(expression);
		let aliasHops = 0;
		while (!isConstruction(current)) {
			if (isCallExpression(current) && isMemberExpression(current.callee)) {
				current = stripExpressionWrappers(current.callee.object);
				continue;
			}

			if (aliasHops === MAX_ALIAS_HOPS || !isIdentifier(current)) return false;

			const initializer = getSingleConstInitializer(getReferencedVariable(sourceCode, current));
			if (initializer === undefined) return false;

			current = stripExpressionWrappers(initializer);
			aliasHops += 1;
		}

		return true;
	}

	function isCommandClass({ superClass }: ESTree.Class): boolean {
		return superClass !== null && isCommandClassReference(superClass);
	}

	return { isCommand, isCommandClass, isConstruction };
}
