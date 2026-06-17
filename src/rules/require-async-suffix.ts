import { defineRule } from "oxlint-plugin-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

function hasAsyncSuffix(name: string): boolean {
	return name.endsWith("Async");
}

function isPropertyInCallArgument(node: ESTree.ObjectProperty): boolean {
	const { parent } = node;
	if (parent.type !== "ObjectExpression") return false;
	const { parent: grandparent } = parent;
	if (grandparent.type === "CallExpression" || grandparent.type === "NewExpression") {
		return (grandparent.arguments as ReadonlyArray<ESTree.Node>).includes(parent);
	}
	return false;
}

const requireAsyncSuffix = defineRule({
	create(context): Visitor {
		const exceptOption = context.options[0]?.except;
		const exceptSet: ReadonlySet<string> = exceptOption === undefined ? new Set() : new Set(exceptOption);

		function shouldSkipName(name: string): boolean {
			return hasAsyncSuffix(name) || exceptSet.has(name);
		}

		function reportIfNotSkipped(node: ESTree.IdentifierName): void {
			if (shouldSkipName(node.name)) return;
			context.report({ messageId: "missingAsyncSuffix", node });
		}

		return {
			FunctionDeclaration(node): void {
				if (!node.async || node.id === null) return;
				reportIfNotSkipped(node.id);
			},
			MethodDefinition(node): void {
				if (!node.value.async || node.key.type !== "Identifier") return;
				reportIfNotSkipped(node.key);
			},
			Property(node): void {
				if (!node.method || node.value.type !== "FunctionExpression" || !node.value.async) return;
				if (node.key.type !== "Identifier") return;
				if (isPropertyInCallArgument(node)) return;
				reportIfNotSkipped(node.key);
			},
			PropertyDefinition(node): void {
				if (node.value?.type !== "ArrowFunctionExpression" && node.value?.type !== "FunctionExpression") return;
				if (!node.value.async || node.key.type !== "Identifier") return;
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
