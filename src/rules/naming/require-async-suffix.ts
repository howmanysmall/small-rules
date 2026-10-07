import { isCallbackFunction, isFunctionExpression, isIdentifier } from "@small-rules/oxlint-utilities";

import { isExternallyConstrainedProperty } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

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
				if (!node.value.async || !isIdentifier(node.key) || node.override === true) return;
				reportIfNotSkipped(node.key);
			},
			Property(node): void {
				if (!node.method || !isFunctionExpression(node.value) || !node.value.async) return;
				if (!isIdentifier(node.key) || isExternallyConstrainedProperty(node)) return;
				reportIfNotSkipped(node.key);
			},
			PropertyDefinition(node): void {
				if (!isCallbackFunction(node.value)) return;
				if (!node.value.async || !isIdentifier(node.key) || node.override === true) return;
				reportIfNotSkipped(node.key);
			},
			VariableDeclarator(node): void {
				if (!isIdentifier(node.id) || !isCallbackFunction(node.init) || !node.init.async) return;
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
