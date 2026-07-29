import { getMemberPropertyName, unwrapExpression } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import { isIdentifierNamed, isMemberExpression } from "$oxc-utilities/oxc-utilities";

import type { ESTree, Visitor } from "oxlint-plugin-utilities";

const ARRAY_INSERTION_METHODS: ReadonlySet<string> = new Set(["push", "unshift"]);
const MATH_VARIADIC_METHODS: ReadonlySet<string> = new Set(["max", "min"]);
const MATH_NAMESPACE = "Math";

function getVariadicMethodName(callee: ESTree.Node): string | undefined {
	if (!isMemberExpression(callee)) return undefined;

	const propertyName = getMemberPropertyName(callee);
	if (propertyName === undefined) return undefined;
	if (ARRAY_INSERTION_METHODS.has(propertyName)) return propertyName;
	if (!MATH_VARIADIC_METHODS.has(propertyName)) return undefined;

	return isIdentifierNamed(callee.object, MATH_NAMESPACE) ? `${MATH_NAMESPACE}.${propertyName}` : undefined;
}

const noVariadicSpread = createRule("no-variadic-spread", "general", {
	createOnce(context): Visitor {
		return {
			CallExpression(node): void {
				const method = getVariadicMethodName(node.callee);
				if (method === undefined) return;

				for (const argument of node.arguments) {
					if (argument.type !== "SpreadElement") continue;
					if (unwrapExpression(argument.argument).type === "ArrayExpression") continue;
					context.report({ data: { method }, messageId: "noVariadicSpread", node: argument });
				}
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description:
				"Disallow spreading a potentially unbounded array into a variadic call, because every element becomes a stack-allocated argument.",
		},
		messages: {
			noVariadicSpread:
				"Spreading an array into {{method}}() passes every element as its own stack argument, so a large array throws 'RangeError: Maximum call stack size exceeded'. Iterate the array instead.",
		},
		schema: [],
		type: "problem",
	},
});

export default noVariadicSpread;
