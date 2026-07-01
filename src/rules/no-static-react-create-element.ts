import { getMemberPropertyName, getVariableByName } from "$oxc-utilities/ast-utilities";
import { getImportedName, isCallbackFunction, isComponentName } from "$oxc-utilities/oxc-utilities";
import { ENVIRONMENT_SCHEMA, getReactSourcesFromOptions } from "$oxc-utilities/react-utilities";
import { isImportBinding, isModuleLevelScope } from "$oxc-utilities/static-expression-utilities";
import { isStringRaw } from "$oxc-utilities/type-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { ScopeVariable } from "$oxc-utilities/ast-utilities";
import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

const REACT_FRAGMENT = "Fragment";

function getImportDeclarationParent(node: ESTree.Node): ESTree.ImportDeclaration | undefined {
	/* v8 ignore next -- parser import bindings retain their ImportDeclaration parent. @preserve */
	return node.parent?.type === "ImportDeclaration" ? node.parent : undefined;
}

function isReactImportDefinition(
	definition: ScopeVariable["defs"][number],
	reactSources: ReadonlySet<string>,
): boolean {
	if (definition.type !== "ImportBinding") return false;

	const importDeclaration = getImportDeclarationParent(definition.node);
	/* v8 ignore next -- ImportBinding definitions are parser-parented by an ImportDeclaration. @preserve */
	if (importDeclaration === undefined) return false;

	return reactSources.has(importDeclaration.source.value);
}

function isReactNamespaceImport(variable: ScopeVariable | undefined, reactSources: ReadonlySet<string>): boolean {
	if (variable === undefined) return false;

	for (const definition of variable.defs) {
		if (!isReactImportDefinition(definition, reactSources)) continue;
		/* v8 ignore next -- @preserve React namespace checks only reach default or namespace import definitions. */
		if (definition.node.type === "ImportDefaultSpecifier" || definition.node.type === "ImportNamespaceSpecifier") {
			return true;
		}
	}

	return false;
}

function isReactNamedImport(
	variable: ScopeVariable | undefined,
	importedName: string,
	reactSources: ReadonlySet<string>,
): boolean {
	if (variable === undefined) return false;

	for (const definition of variable.defs) {
		if (!isReactImportDefinition(definition, reactSources)) continue;
		/* v8 ignore next -- named-import scope lookups expose ImportSpecifier definitions here. @preserve */
		if (definition.node.type !== "ImportSpecifier") continue;
		if (getImportedName(definition.node) === importedName) return true;
	}

	return false;
}

function isReactCreateElementCall(
	sourceCode: SourceCode,
	node: ESTree.CallExpression,
	reactSources: ReadonlySet<string>,
): boolean {
	const { callee } = node;

	if (callee.type === "Identifier") {
		const variable = getVariableByName(sourceCode.getScope(callee), callee.name);
		return isReactNamedImport(variable, "createElement", reactSources);
	}

	if (callee.type !== "MemberExpression") return false;
	if (callee.computed || getMemberPropertyName(callee) !== "createElement") return false;
	if (callee.object.type !== "Identifier") return false;

	const variable = getVariableByName(sourceCode.getScope(callee.object), callee.object.name);
	return isReactNamespaceImport(variable, reactSources);
}

function isStringElementName(node: ESTree.Expression): boolean {
	return node.type === "Literal" && isStringRaw(node.value);
}

function isStaticComponentVariable(variable: ScopeVariable, name: string): boolean {
	if (isImportBinding(variable)) return isComponentName(name) || name === REACT_FRAGMENT;
	if (!isModuleLevelScope(variable.scope)) return false;
	if (!isComponentName(name) && name !== REACT_FRAGMENT) return false;

	for (const definition of variable.defs) {
		if (definition.type === "FunctionName" || definition.type === "ClassName") return true;
		/* v8 ignore next -- module component bindings are imports, functions, classes, or variables. @preserve */
		if (definition.type !== "Variable") continue;
		/* v8 ignore next -- parser variable definitions are backed by VariableDeclarator nodes. @preserve */
		if (definition.node.type !== "VariableDeclarator") continue;

		const initializer = definition.node.init ?? undefined;
		if (initializer === undefined) continue;
		if (isCallbackFunction(initializer) || initializer.type === "ClassExpression") {
			return true;
		}
	}

	return false;
}

function isStaticIdentifierElement(
	sourceCode: SourceCode,
	node: ESTree.IdentifierReference,
	reactSources: ReadonlySet<string>,
): boolean {
	const variable = getVariableByName(sourceCode.getScope(node), node.name);
	if (isReactNamedImport(variable, REACT_FRAGMENT, reactSources)) return true;
	if (variable === undefined) return false;

	return isStaticComponentVariable(variable, node.name);
}

function getMemberRootIdentifier(node: ESTree.MemberExpression): ESTree.IdentifierReference | undefined {
	let current = node;

	while (true) {
		if (current.computed) return undefined;
		if (current.object.type === "Identifier") return current.object;
		if (current.object.type !== "MemberExpression") return undefined;
		current = current.object;
	}
}

function getStaticMemberName(node: ESTree.MemberExpression): string | undefined {
	/* v8 ignore next -- callers reject computed member roots before static-name inspection. @preserve */
	if (node.computed) return undefined;
	const propertyName = getMemberPropertyName(node);
	/* v8 ignore next -- non-computed parser members expose a static property name here. @preserve */
	if (propertyName === undefined) return undefined;
	if (node.object.type !== "MemberExpression") return propertyName;
	/* v8 ignore next -- @preserve member roots are validated before recursive static-name checks. */
	return getStaticMemberName(node.object) === undefined ? undefined : propertyName;
}

function isStaticMemberElement(
	sourceCode: SourceCode,
	node: ESTree.MemberExpression,
	reactSources: ReadonlySet<string>,
): boolean {
	const rootIdentifier = getMemberRootIdentifier(node);
	if (rootIdentifier === undefined) return false;

	const propertyName = getStaticMemberName(node);
	/* v8 ignore next -- getStaticMemberName only fails for shapes filtered before this call. @preserve */
	if (propertyName === undefined) return false;

	const rootVariable = getVariableByName(sourceCode.getScope(rootIdentifier), rootIdentifier.name);
	if (isReactNamespaceImport(rootVariable, reactSources) && propertyName === REACT_FRAGMENT) return true;
	if (rootVariable === undefined || !isImportBinding(rootVariable)) return false;

	return isComponentName(propertyName);
}

function isStaticElementArgument(
	sourceCode: SourceCode,
	argument: ESTree.CallExpression["arguments"][number],
	reactSources: ReadonlySet<string>,
): boolean {
	if (argument.type === "SpreadElement") return false;
	if (isStringElementName(argument)) return true;
	if (argument.type === "Identifier") return isStaticIdentifierElement(sourceCode, argument, reactSources);
	if (argument.type === "MemberExpression") return isStaticMemberElement(sourceCode, argument, reactSources);
	return false;
}

const noStaticReactCreateElement = defineRule({
	create(context): Visitor {
		const reactSources = getReactSourcesFromOptions(context.options[0]);
		const { sourceCode } = context;

		return {
			CallExpression(node): void {
				if (!isReactCreateElementCall(sourceCode, node, reactSources)) return;

				const [elementArgument] = node.arguments;
				if (elementArgument === undefined) return;
				if (!isStaticElementArgument(sourceCode, elementArgument, reactSources)) return;

				context.report({
					messageId: "useJsx",
					node,
				});
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Require JSX for static React.createElement calls.",
			recommended: true,
		},
		messages: {
			useJsx: "Use JSX instead of static React.createElement calls.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					environment: ENVIRONMENT_SCHEMA,
				},
				type: "object",
			},
		],
		type: "problem",
	},
});

export default noStaticReactCreateElement;
