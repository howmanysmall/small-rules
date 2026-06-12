import { defineRule } from "oxlint-plugin-utilities";

import type { Context, ESTree, Fix, Visitor } from "oxlint-plugin-utilities";

function getEnclosingFunctionName(node: ESTree.Node): string | undefined {
	let current: ESTree.Node | null = node.parent;

	while (current !== null) {
		switch (current.type) {
			case "FunctionDeclaration":
				return current.id?.name;

			case "FunctionExpression": {
				if (current.id) return current.id.name;
				return getAssignedName(current);
			}

			case "ArrowFunctionExpression":
				return getAssignedName(current);

			default:
				break;
		}

		current = current.parent;
	}

	return undefined;
}

function getAssignedName({ parent }: ESTree.Node): string | undefined {
	if (parent?.type === "VariableDeclarator" && parent.id.type === "Identifier") return parent.id.name;
	if ((parent?.type === "Property" || parent?.type === "MethodDefinition") && parent.key.type === "Identifier") {
		return parent.key.name;
	}

	return undefined;
}

function getUniqueVariableName({ sourceCode }: Context, node: ESTree.Node, base: string): string {
	try {
		const scope = sourceCode.getScope(node);
		const names = new Set(scope.variables.map((variable) => variable.name));
		if (!names.has(base)) return base;
		for (let index = 2; index < 100; index += 1) {
			const candidate = `${base}${index}`;
			if (!names.has(candidate)) return candidate;
		}
	} catch {
		/* scope API unavailable — fall back to base name */
	}

	return base;
}

const requireThrowErrorCapture = defineRule({
	create(context): Visitor {
		const { sourceCode } = context;

		return {
			ThrowStatement(node): void {
				const { argument } = node;
				if (argument.type !== "NewExpression") return;

				const { callee } = argument;
				if (callee.type !== "Identifier" || !callee.name.endsWith("Error")) return;

				const functionName = getEnclosingFunctionName(node);

				context.report({
					messageId: "missingCaptureStackTrace",
					node,
					...(functionName === undefined
						? {}
						: {
								fix(fixer): Fix {
									const variableName = getUniqueVariableName(context, node, "error");

									const replacement = [
										`const ${variableName} = ${sourceCode.getText(argument)};`,
										`Error.captureStackTrace(${variableName}, ${functionName});`,
										`throw ${variableName};`,
									].join(`\n`);

									return fixer.replaceText(node, replacement);
								},
							}),
				});
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Require 'Error.captureStackTrace' before throwing errors to produce accurate stack traces.",
			recommended: false,
		},
		fixable: "code",
		messages: {
			missingCaptureStackTrace:
				"Call 'Error.captureStackTrace' on this error before throwing it so the stack trace points to the throw site.",
		},
		schema: [],
		type: "suggestion",
	},
});

export default requireThrowErrorCapture;
