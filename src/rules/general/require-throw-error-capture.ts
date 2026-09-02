import { Predicate } from "effect";

import { createRule } from "$oxc-utilities/create-rule";
import {
	ARROW_FUNCTION_EXPRESSION,
	FUNCTION_DECLARATION,
	FUNCTION_EXPRESSION,
	isBlockStatement,
	isCatchClause,
	isClassBody,
	isIdentifierName,
	isImportDeclaration,
	isMethodDefinitionRaw,
	isNewExpression,
	isPrivateIdentifier,
	isPropertyDefinitionRaw,
	isVariableDeclarator,
} from "$oxc-utilities/oxc-utilities";

import type { ESTree, Fix, Scope, SourceCode, Visitor } from "oxlint-plugin-utilities";

type ErrorSpecifier =
	| string
	| {
			readonly from?: "file" | "library" | "package" | undefined;
			readonly name: ReadonlyArray<string> | string;
			readonly package?: string | undefined;
			readonly path?: string | undefined;
	  };

function getEnclosingFunctionName(node: ESTree.Node): string | undefined {
	let current: ESTree.Node | null = node.parent;

	while (current !== null) {
		switch (current.type) {
			case ARROW_FUNCTION_EXPRESSION:
				return getAssignedName(current);

			case FUNCTION_DECLARATION:
				return current.id?.name;

			case FUNCTION_EXPRESSION: {
				if (current.id) return current.id.name;
				return getAssignedName(current);
			}

			default:
				break;
		}

		current = current.parent;
	}

	/* v8 ignore start -- @preserve throw statements are visited only inside parsed statement ancestors. */
	return undefined;
	/* v8 ignore stop -- @preserve */
}

function getAssignedName({ parent }: ESTree.Node): string | undefined {
	if (isVariableDeclarator(parent) && isIdentifierName(parent.id)) return parent.id.name;
	if (isPropertyDefinitionRaw(parent) || isMethodDefinitionRaw(parent)) {
		if (isPrivateIdentifier(parent.key)) return `#${parent.key.name}`;
		/* v8 ignore next -- @preserve class and object member keys are identifiers after private keys are handled. */
		if (isIdentifierName(parent.key)) return parent.key.name;
	}

	return undefined;
}

function isClassMethodContext(node: ESTree.Node): boolean {
	let current: ESTree.Node | null = node.parent;
	while (current !== null) {
		switch (current.type) {
			case ARROW_FUNCTION_EXPRESSION:
				return isPropertyDefinitionRaw(current.parent) && isClassBody(current.parent.parent);

			case FUNCTION_DECLARATION:
				return false;

			case FUNCTION_EXPRESSION: {
				return (
					(isMethodDefinitionRaw(current.parent) || isPropertyDefinitionRaw(current.parent)) &&
					isClassBody(current.parent.parent)
				);
			}

			default:
				break;
		}

		current = current.parent;
	}

	/* v8 ignore next -- @preserve class-method checks always terminate at a parsed function ancestor. */
	return false;
}

function getUniqueVariableName(sourceCode: SourceCode, node: ESTree.Node, base: string): string {
	try {
		const scope = sourceCode.getScope(node);
		const names = new Set(scope.variables.map((variable) => variable.name));

		// Catch clause parameters may not appear in scope.variables, so walk
		// ancestors
		let current: ESTree.Node | null = node.parent;
		while (current !== null) {
			if (isCatchClause(current) && isIdentifierName(current.param)) names.add(current.param.name);
			current = current.parent;
		}

		if (!names.has(base)) return base;
		for (let index = 2; index < 100; index += 1) {
			const candidate = `${base}${index}`;
			/* v8 ignore next -- @preserve generated names below error99 are enough for lint fixes. */
			if (!names.has(candidate)) return candidate;
		}
	} catch {
		/* scope API unavailable — fall back to base name */
	}

	/* v8 ignore start -- @preserve generated names below error99 are enough for lint fixes. */
	return base;
	/* v8 ignore stop -- @preserve */
}

function resolveImportSource(sourceCode: SourceCode, node: ESTree.IdentifierReference): string | undefined {
	try {
		let scope: null | Scope = sourceCode.getScope(node);
		while (scope !== null) {
			const variable = scope.set.get(node.name);
			if (variable !== undefined) {
				const importBinding = variable.defs.find((definition) => definition.type === "ImportBinding");
				if (isImportDeclaration(importBinding?.parent)) return importBinding.parent.source.value;
				return undefined;
			}

			scope = scope.upper;
		}
	} catch {
		/* scope API unavailable */
	}

	/* v8 ignore start -- @preserve scope lookup failures fall back to unresolved imports. */
	return undefined;
	/* v8 ignore stop -- @preserve */
}

function isDeclaredLocally(sourceCode: SourceCode, node: ESTree.IdentifierReference): boolean {
	try {
		let scope: null | Scope = sourceCode.getScope(node);
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
	if (Predicate.isString(specifier)) return calleeName === specifier;

	const names = Array.isArray(specifier.name) ? specifier.name : [specifier.name];
	return names.includes(calleeName);
}

function matchesSpecifier(
	sourceCode: SourceCode,
	physicalFilename: string,
	node: ESTree.IdentifierReference,
	specifier: ErrorSpecifier,
): boolean {
	if (!nameMatches(specifier, node.name)) return false;
	if (Predicate.isString(specifier)) return true;

	/* v8 ignore next -- @preserve rule schema restricts object specifiers to handled source kinds. */
	switch (specifier.from) {
		case "file": {
			const isLocal = isDeclaredLocally(sourceCode, node) && resolveImportSource(sourceCode, node) === undefined;
			if (!isLocal) return false;
			if (specifier.path === undefined) return true;
			if (physicalFilename === "<input>" || physicalFilename === "<text>") return false;
			return physicalFilename.endsWith(specifier.path);
		}

		case "library":
			return sourceCode.isGlobalReference(node);

		case "package":
			return resolveImportSource(sourceCode, node) === specifier.package;

		case undefined:
			return true;

		default:
			/* v8 ignore start -- @preserve rule schema restricts specifier.from to handled values. */
			return false;
		/* v8 ignore stop -- @preserve */
	}
}

function isAllowedError(
	sourceCode: SourceCode,
	physicalFilename: string,
	node: ESTree.IdentifierReference,
	allowList: ReadonlyArray<ErrorSpecifier>,
): boolean {
	return allowList.some((specifier) => matchesSpecifier(sourceCode, physicalFilename, node, specifier));
}

const requireThrowErrorCapture = createRule("require-throw-error-capture", "general", {
	create(context): Visitor {
		const { sourceCode } = context;
		const allowList = context.options[0]?.allow ?? [];

		// oxlint-disable typescript/no-unnecessary-condition -- so dumb
		/* v8 ignore next -- @preserve the rule harness and Oxlint provide a physical filename for rule execution. */
		const physicalFilename = context.physicalFilename ?? "<input>";
		// oxlint-enable typescript/no-unnecessary-condition -- so dumb

		return {
			ThrowStatement(node): void {
				const { argument } = node;
				if (!isNewExpression(argument)) return;

				const { callee } = argument;
				if (!isIdentifierName(callee) || !callee.name.endsWith("Error")) return;

				if (isAllowedError(sourceCode, physicalFilename, callee, allowList)) return;

				const functionName = getEnclosingFunctionName(node);
				if (functionName === undefined) return;

				const isMethod = isClassMethodContext(node);
				const capturedName = isMethod ? `this.${functionName}` : functionName;

				context.report({
					fix(fixer): Fix {
						const variableName = getUniqueVariableName(sourceCode, node, "error");

						const replacement = [
							`const ${variableName} = ${sourceCode.getText(argument)};`,
							`Error.captureStackTrace(${variableName}, ${capturedName});`,
							`throw ${variableName};`,
						].join("\n");

						if (isBlockStatement(node.parent)) return fixer.replaceText(node, replacement);
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
										name: {
											anyOf: [{ type: "string" }, { items: { type: "string" }, type: "array" }],
											description: "Name(s) of the error class",
										},
										from: {
											description: "Where the error class is declared",
											enum: ["file", "library", "package"],
											type: "string",
										},
										package: {
											description:
												"Package the error class is imported from (required when from is 'package')",
											type: "string",
										},
										path: {
											description:
												"Optional file path filter for file specifiers (matched against the end of the file path)",
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
