import { isStringRaw } from "$oxc-utilities/type-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { ESTree, Fix, Scope, SourceCode, Visitor } from "oxlint-plugin-utilities";

type ErrorSpecifier =
	| string
	| {
			readonly from?: "file" | "library" | "package";
			readonly name: string | ReadonlyArray<string>;
			readonly package?: string;
			readonly path?: string;
	  };

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

	/* v8 ignore start -- @preserve throw statements are visited only inside parsed statement ancestors. */
	return undefined;
	/* v8 ignore stop -- @preserve */
}

function getAssignedName({ parent }: ESTree.Node): string | undefined {
	if (parent?.type === "VariableDeclarator" && parent.id.type === "Identifier") return parent.id.name;
	if (parent?.type === "PropertyDefinition" || parent?.type === "MethodDefinition") {
		if (parent.key.type === "PrivateIdentifier") return `#${parent.key.name}`;
		/* v8 ignore next -- @preserve class and object member keys are identifiers after private keys are handled. */
		if (parent.key.type === "Identifier") return parent.key.name;
	}

	return undefined;
}

function isClassMethodContext(node: ESTree.Node): boolean {
	let current: ESTree.Node | null = node.parent;
	while (current !== null) {
		switch (current.type) {
			case "FunctionDeclaration":
				return false;

			case "FunctionExpression": {
				return (
					(current.parent?.type === "MethodDefinition" || current.parent?.type === "PropertyDefinition") &&
					current.parent.parent?.type === "ClassBody"
				);
			}

			case "ArrowFunctionExpression": {
				return current.parent?.type === "PropertyDefinition" && current.parent.parent?.type === "ClassBody";
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

		// Catch clause parameters may not appear in scope.variables, so walk ancestors
		let current: ESTree.Node | null = node.parent;
		while (current !== null) {
			if (current.type === "CatchClause" && current.param?.type === "Identifier") names.add(current.param.name);
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
		let scope: Scope | null = sourceCode.getScope(node);
		while (scope !== null) {
			const variable = scope.set.get(node.name);
			if (variable !== undefined) {
				const importBinding = variable.defs.find((definition) => definition.type === "ImportBinding");
				if (importBinding?.parent?.type === "ImportDeclaration") return importBinding.parent.source.value;
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
	if (isStringRaw(specifier)) return calleeName === specifier;

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
	if (isStringRaw(specifier)) return true;

	/* v8 ignore next -- @preserve rule schema restricts object specifiers to handled source kinds. */
	switch (specifier.from) {
		case undefined:
			return true;

		case "package":
			return resolveImportSource(sourceCode, node) === specifier.package;

		case "file": {
			const isLocal = isDeclaredLocally(sourceCode, node) && resolveImportSource(sourceCode, node) === undefined;
			if (!isLocal) return false;
			if (specifier.path === undefined) return true;
			if (physicalFilename === "<input>" || physicalFilename === "<text>") return false;
			return physicalFilename.endsWith(specifier.path);
		}

		case "library":
			return sourceCode.isGlobalReference(node);

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

const requireThrowErrorCapture = defineRule({
	create(context): Visitor {
		const { sourceCode } = context;
		const allowList = context.options[0]?.allow ?? [];
		/* v8 ignore next -- @preserve RuleTester and Oxlint provide a physical filename for rule execution. */
		const physicalFilename = context.physicalFilename ?? "<input>";

		return {
			ThrowStatement(node): void {
				const { argument } = node;
				if (argument.type !== "NewExpression") return;

				const { callee } = argument;
				if (callee.type !== "Identifier" || !callee.name.endsWith("Error")) return;

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
											enum: ["file", "library", "package"],
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
