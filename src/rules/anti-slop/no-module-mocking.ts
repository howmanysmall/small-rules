// Vendored from src/rules/no-module-mocking.ts@446268e5d15baa968eaec669ff65358d36ae6259 by Dillon Mulroy.
// Source: https://github.com/dmmulroy/anti-slop
// SPDX-License-Identifier: MIT
//
// Modifications: local API and path alias adaptation.

import { getVariableByName } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";

import type { ESTree, SourceCode, Variable, Visitor } from "oxlint-plugin-utilities";

const MODULE_MOCK_METHODS = new Set(["doMock", "mock", "unstable_mockModule"]);

function resolveVariable(sourceCode: SourceCode, identifier: ESTree.IdentifierReference): undefined | Variable {
	return getVariableByName(sourceCode.getScope(identifier), identifier.name);
}

function isFrameworkImport(variable: Variable): boolean {
	return variable.defs.some((definition) => {
		if (definition.type !== "ImportBinding" || definition.parent?.type !== "ImportDeclaration") return false;
		if (definition.node.type !== "ImportSpecifier") return false;
		const importedName =
			definition.node.imported.type === "Identifier"
				? definition.node.imported.name
				: definition.node.imported.value;
		return (
			(definition.parent.source.value === "vitest" && importedName === "vi") ||
			(definition.parent.source.value === "@jest/globals" && importedName === "jest")
		);
	});
}

function isTestFrameworkObject(
	sourceCode: SourceCode,
	expression: ESTree.Expression,
): expression is ESTree.IdentifierReference {
	if (expression.type !== "Identifier") return false;
	if ((expression.name === "vi" || expression.name === "jest") && sourceCode.isGlobalReference(expression)) {
		return true;
	}
	const variable = resolveVariable(sourceCode, expression);
	return variable === undefined
		? expression.name === "vi" || expression.name === "jest"
		: variable.defs.length === 0 || isFrameworkImport(variable);
}

function isModuleMockCall(sourceCode: SourceCode, callee: ESTree.Expression): boolean {
	if (!("property" in callee) || !("object" in callee) || !("computed" in callee)) return false;
	if (!isTestFrameworkObject(sourceCode, callee.object)) return false;
	if (callee.computed) {
		return (
			callee.property.type === "Literal" &&
			typeof callee.property.value === "string" &&
			MODULE_MOCK_METHODS.has(callee.property.value)
		);
	}
	return callee.property.type === "Identifier" && MODULE_MOCK_METHODS.has(callee.property.name);
}

const noModuleMocking = createRule("no-module-mocking", "anti-slop", {
	createOnce(context): Visitor {
		return {
			CallExpression(node): void {
				/* v8 ignore next -- Oxc's parser does not produce V8 intrinsic call expressions. @preserve */
				if (node.callee.type === "Super" || node.callee.type === "V8IntrinsicExpression") return;
				if (isModuleMockCall(context.sourceCode, node.callee)) {
					context.report({ messageId: "moduleMock", node });
				}
			},
		};
	},
	meta: {
		docs: {
			description:
				"Disallow Vitest and Jest module mocking; tests must replace dependencies through real interfaces.",
			recommended: true,
		},
		messages: {
			moduleMock:
				"Replace module mocking with dependency injection through a real interface, service layer, or faithful test implementation.",
		},
		type: "problem",
	},
});

export default noModuleMocking;
