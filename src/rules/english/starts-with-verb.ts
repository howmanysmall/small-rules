import { isCallbackFunction, isIdentifier, isPrivateIdentifier } from "@small-rules/oxlint-utilities";

import { isExternallyConstrainedProperty } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import { startsWithVerb as checkStartsWithVerb } from "$oxc-utilities/english-utilities";

import type { ESTree, VisitorWithHooks } from "oxlint-plugin-utilities";

type NameNode = ESTree.IdentifierName | ESTree.PrivateIdentifier;

const EMPTY_LIST: ReadonlyArray<string> = [];

function getMemberNameNode(key: ESTree.Node, computed: boolean): NameNode | undefined {
	if (computed) return undefined;
	return isIdentifier(key) || isPrivateIdentifier(key) ? key : undefined;
}

const startsWithVerb = createRule("starts-with-verb", "english", {
	createOnce(context): VisitorWithHooks {
		let extraAllowList = EMPTY_LIST;
		let extraDenyList = EMPTY_LIST;

		function reportIfNotVerb(node: NameNode): void {
			const [doesStartWithVerb, prefix] = checkStartsWithVerb(node.name, { extraAllowList, extraDenyList });
			if (doesStartWithVerb) return;
			context.report({ data: { name: node.name, prefix }, messageId: "notVerb", node });
		}

		return {
			before(): void {
				const [options] = context.options;
				extraAllowList = options?.allowList ?? EMPTY_LIST;
				extraDenyList = options?.denyList ?? EMPTY_LIST;
			},
			FunctionDeclaration(node): void {
				if (node.id !== null) reportIfNotVerb(node.id);
			},
			MethodDefinition(node): void {
				if (node.kind !== "method" || node.override === true) return;
				const nameNode = getMemberNameNode(node.key, node.computed);
				if (nameNode !== undefined) reportIfNotVerb(nameNode);
			},
			Property(node): void {
				if (node.kind !== "init" || !isCallbackFunction(node.value)) return;
				const nameNode = getMemberNameNode(node.key, node.computed);
				if (nameNode === undefined || isExternallyConstrainedProperty(node)) return;
				reportIfNotVerb(nameNode);
			},
			PropertyDefinition(node): void {
				if (!isCallbackFunction(node.value) || node.override === true) return;
				const nameNode = getMemberNameNode(node.key, node.computed);
				if (nameNode !== undefined) reportIfNotVerb(nameNode);
			},
			VariableDeclarator(node): void {
				if (isIdentifier(node.id) && isCallbackFunction(node.init)) reportIfNotVerb(node.id);
			},
		};
	},
	meta: {
		docs: {
			description: "Require function and method names to begin with a verb.",
			recommended: true,
		},
		messages: {
			notVerb: "'{{name}}' should begin with a verb, but '{{prefix}}' is not one.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					allowList: {
						items: { type: "string" },
						type: "array",
					},
					denyList: {
						items: { type: "string" },
						type: "array",
					},
				},
				type: "object",
			},
		] as const,
		type: "suggestion",
	},
});

export default startsWithVerb;
