import { defineRule } from "oxlint-plugin-utilities";

import type { ESTree, Fix, Scope, SourceCode, Visitor } from "oxlint-plugin-utilities";

type ErrorSpecifier =
	| string
	| {
			readonly from?: "file" | "lib" | "package";
			readonly package?: string;
			readonly name: string | ReadonlyArray<string>;
	  };

interface RequireThrowErrorCaptureOptions {
	readonly allow?: ReadonlyArray<ErrorSpecifier>;
}

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

function getUniqueVariableName(sourceCode: SourceCode, node: ESTree.Node, base: string): string {
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

function resolveImportSource(sourceCode: SourceCode, node: ESTree.IdentifierReference): string | undefined {
	try {
		let scope: Scope | null = sourceCode.getScope(node);
		while (scope !== null) {
			const variable = scope.set.get(node.name);
			if (variable !== undefined) {
				const importBindingDefinition = variable.defs.find((definition) => definition.type === "ImportBinding");
				if (importBindingDefinition?.parent?.type === "ImportDeclaration") {
					return importBindingDefinition.parent.source.value;
				}

				return undefined;
			}

			scope = scope.upper;
		}
	} catch {
		/* scope API unavailable */
	}

	return undefined;
}

function isDeclaredLocally(sourceCode: SourceCode, node: ESTree.IdentifierReference): boolean {
	try {
		let scope: Scope | null = sourceCode.getScope(node);
		while (scope !== null) {
			if (scope.set.has(node.name)) return true;
			scope = scope.upper;
		}
	} catch {
		/* scope API unavailable */
	}

	return false;
}

function nameMatches(specifier: ErrorSpecifier, calleeName: string): boolean {
	if (typeof specifier === "string") return calleeName === specifier;

	const names = Array.isArray(specifier.name) ? specifier.name : [specifier.name];
	return names.includes(calleeName);
}

function matchesSpecifier(
	sourceCode: SourceCode,
	node: ESTree.IdentifierReference,
	specifier: ErrorSpecifier,
): boolean {
	if (!nameMatches(specifier, node.name)) return false;
	if (typeof specifier === "string") return true;

	switch (specifier.from) {
		case undefined:
			return true;

		case "package":
			return resolveImportSource(sourceCode, node) === specifier.package;

		case "file":
			return isDeclaredLocally(sourceCode, node) && resolveImportSource(sourceCode, node) === undefined;

		case "lib":
			return sourceCode.isGlobalReference(node);

		default:
			return false;
	}
}

function isAllowedError(
	sourceCode: SourceCode,
	node: ESTree.IdentifierReference,
	allowList: ReadonlyArray<ErrorSpecifier>,
): boolean {
	return allowList.some((specifier) => matchesSpecifier(sourceCode, node, specifier));
}

const requireThrowErrorCapture = defineRule({
	create(context): Visitor {
		const { sourceCode } = context;
		const [rawOptions] = context.options;
		const options: RequireThrowErrorCaptureOptions = (rawOptions ?? {}) as RequireThrowErrorCaptureOptions;
		const allowList = options.allow ?? [];

		return {
			ThrowStatement(node): void {
				const { argument } = node;
				if (argument.type !== "NewExpression") return;

				const { callee } = argument;
				if (callee.type !== "Identifier" || !callee.name.endsWith("Error")) return;

				if (isAllowedError(sourceCode, callee, allowList)) return;

				const functionName = getEnclosingFunctionName(node);
				if (functionName === undefined) return;

				context.report({
					fix(fixer): Fix {
						const variableName = getUniqueVariableName(sourceCode, node, "error");

						const replacement = [
							`const ${variableName} = ${sourceCode.getText(argument)};`,
							`Error.captureStackTrace(${variableName}, ${functionName});`,
							`throw ${variableName};`,
						].join(`\n`);

						if (node.parent?.type === "BlockStatement") return fixer.replaceText(node, replacement);
						return fixer.replaceText(node, `{\n${replacement}\n}`);
					},
					messageId: "missingCaptureStackTrace",
					node,
				});
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description:
				"Require 'Error.captureStackTrace' before directly throwing new Error instances in named functions.",
			recommended: false,
		},
		fixable: "code",
		messages: {
			missingCaptureStackTrace:
				"Call 'Error.captureStackTrace' on this error before throwing it so the stack trace points to the throw site.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					allow: {
						description: "Error classes that do not need Error.captureStackTrace",
						items: {
							anyOf: [
								{ type: "string" },
								{
									additionalProperties: false,
									properties: {
										from: {
											description: "Where the error class is declared",
											enum: ["file", "lib", "package"],
											type: "string",
										},
										name: {
											anyOf: [{ type: "string" }, { items: { type: "string" }, type: "array" }],
											description: "Name(s) of the error class",
										},
										package: {
											description:
												"Package the error class is imported from (required when from is 'package')",
											type: "string",
										},
									},
									required: ["name"],
									type: "object",
								},
							],
						},
						type: "array",
					},
				},
				type: "object",
			},
		],
		type: "suggestion",
	},
});

export default requireThrowErrorCapture;
