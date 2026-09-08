import { createRule } from "$oxc-utilities/create-rule";
import {
	isCallbackFunction,
	isCallExpression,
	isFunctionExpression,
	isIdentifierName,
	isNewExpression,
	isObjectExpression,
	isTsSatisfiesExpression,
} from "$oxc-utilities/oxc-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

function isExternallyConstrainedProperty({ parent }: ESTree.ObjectProperty): boolean {
	/* v8 ignore next -- Property visitors are reached with ObjectExpression parents. @preserve */
	if (!isObjectExpression(parent)) return false;
	const { parent: grandparent } = parent;
	if (isTsSatisfiesExpression(grandparent)) return true;
	if (isCallExpression(grandparent) || isNewExpression(grandparent)) {
		return grandparent.arguments.some((argument) => argument === parent);
	}
	return false;
}

const requireAsyncSuffix = createRule("require-async-suffix", "naming", {
	create(context): Visitor {
		const exceptOption = context.options[0]?.except;
		const exceptSet: ReadonlySet<string> = exceptOption === undefined ? new Set() : new Set(exceptOption);

		function reportIfNotSkipped(node: ESTree.IdentifierName): void {
			if (node.name.endsWith("Async") || exceptSet.has(node.name)) return;
			context.report({ messageId: "missingAsyncSuffix", node });
		}

		return {
			FunctionDeclaration(node): void {
				if (!node.async || node.id === null) return;
				reportIfNotSkipped(node.id);
			},
			MethodDefinition(node): void {
				if (!node.value.async || !isIdentifierName(node.key) || node.override === true) return;
				reportIfNotSkipped(node.key);
			},
			Property(node): void {
				if (!node.method || !isFunctionExpression(node.value) || !node.value.async) return;
				if (!isIdentifierName(node.key) || isExternallyConstrainedProperty(node)) return;
				reportIfNotSkipped(node.key);
			},
			PropertyDefinition(node): void {
				if (!isCallbackFunction(node.value)) return;
				if (!node.value.async || !isIdentifierName(node.key) || node.override === true) return;
				reportIfNotSkipped(node.key);
			},
			VariableDeclarator(node): void {
				if (!isIdentifierName(node.id) || !isCallbackFunction(node.init) || !node.init.async) return;
				reportIfNotSkipped(node.id);
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Require async function names to end with Async.",
		},
		messages: {
			missingAsyncSuffix: "Async functions must have names that end with Async.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					except: {
						items: { type: "string" },
						type: "array",
					},
				},
				type: "object",
			},
		] as const,
		type: "problem",
	},
});

export default requireAsyncSuffix;
