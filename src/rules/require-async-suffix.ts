import { createRule } from "$oxc-utilities/create-rule";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

function isExternallyConstrainedProperty(node: ESTree.ObjectProperty): boolean {
	const { parent } = node;
	/* v8 ignore next -- Property visitors are reached with ObjectExpression parents. @preserve */
	if (parent.type !== "ObjectExpression") return false;
	const { parent: grandparent } = parent;
	if (grandparent.type === "TSSatisfiesExpression") return true;
	if (grandparent.type === "CallExpression" || grandparent.type === "NewExpression") {
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
				if (!node.value.async || node.key.type !== "Identifier" || node.override === true) return;
				reportIfNotSkipped(node.key);
			},
			Property(node): void {
				if (!node.method || node.value.type !== "FunctionExpression" || !node.value.async) return;
				if (node.key.type !== "Identifier" || isExternallyConstrainedProperty(node)) return;
				reportIfNotSkipped(node.key);
			},
			PropertyDefinition(node): void {
				if (node.value?.type !== "ArrowFunctionExpression" && node.value?.type !== "FunctionExpression") return;
				if (!node.value.async || node.key.type !== "Identifier" || node.override === true) return;
				reportIfNotSkipped(node.key);
			},
			VariableDeclarator(node): void {
				if (node.id.type !== "Identifier") return;
				if (node.init?.type !== "ArrowFunctionExpression" && node.init?.type !== "FunctionExpression") return;
				if (!node.init.async) return;
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
