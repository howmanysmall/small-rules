import {
	ARROW_FUNCTION_EXPRESSION,
	FUNCTION_DECLARATION,
	FUNCTION_EXPRESSION,
	isBlockStatement,
	isCatchClause,
	isClassBody,
	isIdentifier,
	isImportDeclaration,
	isMemberExpression,
	isMethodDefinitionRaw,
	isNewExpression,
	isPrivateIdentifier,
	isProperty,
	isPropertyDefinitionRaw,
	isVariableDeclarator,
} from "@small-rules/oxlint-utilities";
import { Predicate } from "effect";

import { forEachNode } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";

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
	let current = node.parent;

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
	if (isVariableDeclarator(parent) && isIdentifier(parent.id)) return parent.id.name;

	if (isPropertyDefinitionRaw(parent) || isMethodDefinitionRaw(parent)) {
		if (isPrivateIdentifier(parent.key)) return `#${parent.key.name}`;
		/* v8 ignore next -- @preserve class and object member keys are identifiers after private keys are handled. */
		if (isIdentifier(parent.key)) return parent.key.name;
	}

	return undefined;
}

type ClassMember = ESTree.MethodDefinition | ESTree.PropertyDefinition;

/**
 * Finds the class member whose function holds the node.
 *
 * @param node - A node inside the function.
 * @returns The method or property that the nearest function is the value of,
 *   or `undefined` when that function is not a class member.
 */
function getEnclosingClassMember(node: ESTree.Node): ClassMember | undefined {
	let current = node.parent;
	while (current !== null) {
		switch (current.type) {
			case ARROW_FUNCTION_EXPRESSION: {
				return isPropertyDefinitionRaw(current.parent) && isClassBody(current.parent.parent)
					? current.parent
					: undefined;
			}

			case FUNCTION_DECLARATION:
				return undefined;

			case FUNCTION_EXPRESSION: {
				const { parent } = current;
				return (isMethodDefinitionRaw(parent) || isPropertyDefinitionRaw(parent)) && isClassBody(parent.parent)
					? parent
					: undefined;
			}

			default:
				break;
		}

		current = current.parent;
	}

	/* v8 ignore next -- @preserve class-method checks always terminate at a parsed function ancestor. */
	return undefined;
}

function isAccessor(member?: ClassMember): boolean {
	return isMethodDefinitionRaw(member) && (member.kind === "get" || member.kind === "set");
}

/**
 * Whether the throw is reported without a fix. Naming a getter or setter in
 * the call would invoke it, and there is no other name for it. Rebuilding the
 * statement would drop a comment inside it.
 *
 * @param sourceCode - The source code that owns the comments.
 * @param node - The throw statement.
 * @param member - The class member the throw sits in, if any.
 * @returns Whether the fix is withheld.
 */
function isFixWithheld(sourceCode: SourceCode, node: ESTree.ThrowStatement, member?: ClassMember): boolean {
	return isAccessor(member) || sourceCode.getCommentsInside(node).length > 0;
}

function isPropertyName(node: ESTree.Node): boolean {
	const { parent } = node;
	if (isMemberExpression(parent)) return parent.property === node && !parent.computed;
	return isProperty(parent) && parent.key === node && !parent.computed && !parent.shorthand;
}

/**
 * Lists the names the thrown expression reads. The new `const` would shadow
 * them before the expression runs.
 *
 * @param argument - The `new Error(...)` expression that is thrown.
 * @returns The names of the identifiers in the expression that are not a
 *   property name.
 */
function getReadNames(argument: ESTree.Node): Array<string> {
	const names = new Array<string>();
	forEachNode(argument, (node) => {
		if (isIdentifier(node) && !isPropertyName(node)) {
			names.push(node.name);
		}
	});

	return names;
}

function getUniqueVariableName(
	scope: Scope,
	node: ESTree.Node,
	base: string,
	reservedNames: ReadonlySet<string>,
): string {
	const names = new Set(reservedNames);
	for (const variable of scope.variables) {
		names.add(variable.name);
	}

	// Catch clause parameters may not appear in scope.variables, so walk
	// ancestors
	let current = node.parent;
	while (current !== null) {
		if (isCatchClause(current) && isIdentifier(current.param)) {
			names.add(current.param.name);
		}

		current = current.parent;
	}

	if (!names.has(base)) return base;

	for (let index = 2; index < 100; index += 1) {
		const candidate = `${base}${index}`;
		/* v8 ignore next -- @preserve generated names below error99 are enough for lint fixes. */
		if (!names.has(candidate)) return candidate;
	}

	/* v8 ignore next -- @preserve generated names below error99 are enough for lint fixes. */
	return base;
}

function resolveImportSource(sourceCode: SourceCode, node: ESTree.IdentifierReference): string | undefined {
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

	return undefined;
}

function isDeclaredLocally(sourceCode: SourceCode, node: ESTree.IdentifierReference): boolean {
	let scope: null | Scope = sourceCode.getScope(node);
	while (scope !== null) {
		if (scope.set.has(node.name)) return true;
		scope = scope.upper;
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
		const namesReservedByFixes = new WeakMap<Scope, Set<string>>();

		function getReservedNames(scope: Scope): Set<string> {
			let reservedNames = namesReservedByFixes.get(scope);
			if (reservedNames === undefined) {
				reservedNames = new Set();
				namesReservedByFixes.set(scope, reservedNames);
			}

			return reservedNames;
		}

		function pickVariableName(
			node: ESTree.ThrowStatement,
			argument: ESTree.NewExpression,
			capturedFunctionName?: string,
		): string {
			// A throw directly in a block declares its variable there, so
			// other throws fixed in the same pass must pick another name.
			const scope = sourceCode.getScope(node);
			const reservedNames = getReservedNames(scope);
			const readNames = getReadNames(argument);
			if (capturedFunctionName !== undefined) {
				readNames.push(capturedFunctionName);
			}

			const takenNames = new Set([...reservedNames, ...readNames]);
			const variableName = getUniqueVariableName(scope, node, "error", takenNames);
			if (isBlockStatement(node.parent)) {
				reservedNames.add(variableName);
			}

			return variableName;
		}

		// oxlint-disable typescript/no-unnecessary-condition -- so dumb
		/* v8 ignore next -- @preserve the rule harness and Oxlint provide a physical filename for rule execution. */
		const physicalFilename = context.physicalFilename ?? "<input>";
		// oxlint-enable typescript/no-unnecessary-condition -- so dumb

		return {
			ThrowStatement(node): void {
				const { argument } = node;
				if (!isNewExpression(argument)) return;

				const { callee } = argument;
				if (!isIdentifier(callee) || !callee.name.endsWith("Error")) return;

				if (isAllowedError(sourceCode, physicalFilename, callee, allowList)) return;

				const functionName = getEnclosingFunctionName(node);
				if (functionName === undefined) return;

				const member = getEnclosingClassMember(node);
				if (isFixWithheld(sourceCode, node, member)) {
					context.report({ messageId: "missingCaptureStackTrace", node });
					return;
				}

				const capturedName = member === undefined ? functionName : `this.${functionName}`;
				const variableName = pickVariableName(node, argument, member === undefined ? functionName : undefined);

				context.report({
					fix(fixer): Fix {
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
