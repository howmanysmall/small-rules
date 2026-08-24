import { Predicate } from "effect";

import { createRule } from "$oxc-utilities/create-rule";
import { isNode } from "$oxc-utilities/oxc-utilities";

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
	if (node.value.type !== "FunctionExpression") return false;

	const accessibility = node.accessibility ?? "public";
	if (accessibility === "private" && !options.checkPrivate) return false;
	if (accessibility === "protected" && !options.checkProtected) return false;
	if (accessibility === "public" && !options.checkPublic) return false;

	return true;
}

function traverseForThis(currentNode: ESTree.Node, visited: WeakSet<ESTree.Node>): boolean {
	if (visited.has(currentNode)) return false;

	visited.add(currentNode);
	if (currentNode.type === "ThisExpression" || currentNode.type === "Super") return true;
	/* v8 ignore next -- @preserve traversal only recurses into parser nodes. */
	if (!Predicate.isObject(currentNode)) return false;

	// biome-ignore lint/suspicious/noForIn: required for AST traversal
	for (const key in currentNode) {
		/* v8 ignore next -- @preserve for-in over parser nodes only observes own enumerable keys. */
		if (!Object.hasOwn(currentNode, key)) continue;
		if (childUsesThis(currentNode[key], visited)) return true;
	}

	return false;
}

function childUsesThis(childValue: unknown, visited: WeakSet<ESTree.Node>): boolean {
	if (Array.isArray(childValue)) {
		for (const item of childValue) if (isNode(item) && traverseForThis(item, visited)) return true;
		return false;
	}

	return isNode(childValue) && traverseForThis(childValue, visited);
}

function methodUsesThis({ value }: ESTree.MethodDefinition): boolean {
	return traverseForThis(value, new WeakSet());
}

function getMethodName(node: ESTree.MethodDefinition): string {
	return node.key.type === "Identifier" ? node.key.name : "unknown";
}

const noInstanceMethodsWithoutThis = createRule("no-instance-methods-without-this", "roblox", {
	create(context): Visitor {
		const options = normalizeOptions(context.options[0]);

		return {
			MethodDefinition(node: ESTree.MethodDefinition): void {
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
