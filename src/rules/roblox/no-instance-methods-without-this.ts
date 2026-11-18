import {
	isClass,
	isFunctionDeclaration,
	isFunctionExpression,
	isIdentifier,
	isKeyOfNode,
	isMethodDefinition,
	isPropertyDefinition,
	isSuper,
	isThisExpression,
} from "@small-rules/oxlint-utilities";

import { forEachNodeValue } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";

import type { ESTree, InferContextFromRule, Visitor } from "oxlint-plugin-utilities";

type Options = InferContextFromRule<typeof noInstanceMethodsWithoutThis>["options"][0];

type NormalizedOptions = NonNullable<Options>;

const DEFAULT_OPTIONS: NormalizedOptions = {
	checkPrivate: true,
	checkProtected: true,
	checkPublic: true,
};

function normalizeOptions(rawOptions: Options): NormalizedOptions {
	return rawOptions === undefined ? DEFAULT_OPTIONS : { ...DEFAULT_OPTIONS, ...rawOptions };
}

function shouldCheckMethod(node: ESTree.MethodDefinition, options: NormalizedOptions): boolean {
	if (node.static || node.kind !== "method") return false;

	// Skip TypeScript overload signatures and abstract methods: both have no
	// body to inspect.
	if (!isFunctionExpression(node.value)) return false;

	const accessibility = node.accessibility ?? "public";
	if (accessibility === "private" && !options.checkPrivate) return false;
	if (accessibility === "protected" && !options.checkProtected) return false;
	if (accessibility === "public" && !options.checkPublic) return false;

	return true;
}

function visitChildren(node: ESTree.Node, visit: (child: ESTree.Node) => void): void {
	for (const [key, value] of Object.entries(node)) {
		if (isKeyOfNode(key)) continue;
		forEachNodeValue(value, visit);
	}
}

/**
 * A nested class body has its own `this`, but its heritage clause and computed
 * keys are evaluated with the method's.
 *
 * @param node - The nested class.
 * @param worklist - The worklist that receives the nodes using the method's `this`.
 */
function pushClassHeader(node: ESTree.Class, worklist: Array<ESTree.Node>): void {
	if (node.superClass !== null) {
		worklist.push(node.superClass);
	}

	for (const member of node.body.body) {
		if ((isMethodDefinition(member) || isPropertyDefinition(member)) && member.computed) {
			worklist.push(member.key);
		}
	}
}

function methodUsesThis({ value }: ESTree.MethodDefinition): boolean {
	const worklist: Array<ESTree.Node> = [value];

	function enqueue(child: ESTree.Node): void {
		worklist.push(child);
	}

	for (const current of worklist) {
		if (isThisExpression(current) || isSuper(current)) return true;

		if (current !== value && isFunctionDeclaration(current)) continue;

		if (isClass(current)) {
			pushClassHeader(current, worklist);
			continue;
		}

		visitChildren(current, enqueue);
	}

	return false;
}

function getMethodName(node: ESTree.MethodDefinition): string {
	return isIdentifier(node.key) ? node.key.name : "unknown";
}

const noInstanceMethodsWithoutThis = createRule("no-instance-methods-without-this", "roblox", {
	create(context): Visitor {
		const options = normalizeOptions(context.options[0]);

		return {
			MethodDefinition(node): void {
				if (!shouldCheckMethod(node, options) || methodUsesThis(node)) return;

				context.report({
					data: { methodName: getMethodName(node) },
					messageId: "noInstanceMethodWithoutThis",
					node,
				});
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description:
				"Detect instance methods that do not use 'this' and suggest converting them to standalone functions for better performance in roblox-ts.",
		},
		messages: {
			noInstanceMethodWithoutThis:
				"Method '{{methodName}}' does not use 'this' and creates unnecessary metatable overhead in roblox-ts. Convert it to a standalone function for better performance.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					checkPrivate: {
						default: true,
						description: "Check private methods (default: true)",
						type: "boolean",
					},
					checkProtected: {
						default: true,
						description: "Check protected methods (default: true)",
						type: "boolean",
					},
					checkPublic: {
						default: true,
						description: "Check public methods (default: true)",
						type: "boolean",
					},
				},
				type: "object",
			},
		],
		type: "problem",
	},
});

export default noInstanceMethodsWithoutThis;
