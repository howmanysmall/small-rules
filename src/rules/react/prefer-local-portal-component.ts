import nodePath from "node:path";

import { getVariableByName } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import {
	addLocalComponentImportIdentifiers,
	createLocalComponentDiscoverer,
	inspectLocalComponentFile,
	inspectRelativeLocalComponentImport,
} from "$oxc-utilities/local-component-discovery";
import {
	isIdentifierName,
	isImportDeclaration,
	isImportNamespaceSpecifier,
	isImportSpecifier,
	isJsxElement,
	isJsxFragment,
	isMemberExpression,
} from "$oxc-utilities/oxc-utilities";

import type { Definition, ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

import type { ScopeVariable } from "$oxc-utilities/ast-utilities";

const PORTAL_COMPONENT = {
	componentName: "Portal",
	fileNames: ["portal"],
	markers: ["target"],
};
const PORTAL_SOURCES = new Set(["@rbxts/react-roblox", "react-dom"]);
const JSX_EXTENSIONS = new Set([".jsx", ".tsx"]);

function isImportBindingDefinition(definition: Definition): boolean {
	return definition.type === "ImportBinding";
}

function getImportDeclarationParent(node: ESTree.Node): ESTree.ImportDeclaration | undefined {
	/* v8 ignore start -- @preserve import specifier parents are ImportDeclaration nodes in parser output. */
	return isImportDeclaration(node.parent) ? node.parent : undefined;
	/* v8 ignore stop -- @preserve */
}

function isCreatePortalImport(variable?: ScopeVariable): boolean {
	if (variable === undefined) return false;

	for (const definition of variable.defs) {
		if (!isImportBindingDefinition(definition) || !isImportSpecifier(definition.node)) continue;

		const importDeclaration = getImportDeclarationParent(definition.node);
		if (importDeclaration === undefined || !PORTAL_SOURCES.has(importDeclaration.source.value)) continue;

		const { imported } = definition.node;
		/* v8 ignore next -- @preserve createPortal imports are represented as identifier import specifiers by the parser. */
		if (isIdentifierName(imported) && imported.name === "createPortal") return true;
	}

	return false;
}

function isPortalNamespaceImport(variable?: ScopeVariable): boolean {
	if (variable === undefined) return false;

	for (const definition of variable.defs) {
		if (!isImportBindingDefinition(definition) || !isImportNamespaceSpecifier(definition.node)) continue;

		const importDeclaration = getImportDeclarationParent(definition.node);
		/* v8 ignore start -- @preserve namespace import specifier parents are ImportDeclaration nodes in parser output. */
		if (importDeclaration === undefined) continue;
		/* v8 ignore stop -- @preserve */
		if (PORTAL_SOURCES.has(importDeclaration.source.value)) return true;
	}

	return false;
}

function isPortalFactoryCall(sourceCode: SourceCode, { callee }: ESTree.CallExpression): boolean {
	if (isIdentifierName(callee)) {
		return isCreatePortalImport(getVariableByName(sourceCode.getScope(callee), callee.name));
	}

	if (
		!isMemberExpression(callee) ||
		callee.computed ||
		!isIdentifierName(callee.property) ||
		callee.property.name !== "createPortal" ||
		!isIdentifierName(callee.object)
	) {
		return false;
	}

	return isPortalNamespaceImport(getVariableByName(sourceCode.getScope(callee.object), callee.object.name));
}

function renderPortalChild(argument: ESTree.Node, sourceCode: SourceCode): string {
	if (isJsxElement(argument) || isJsxFragment(argument)) return sourceCode.getText(argument);
	return `{${sourceCode.getText(argument)}}`;
}

function getPortalReplacement(
	componentName: string,
	node: ESTree.CallExpression,
	sourceCode: SourceCode,
): string | undefined {
	/* v8 ignore start -- @preserve caller already requires exactly two arguments before requesting a fix. */
	if (node.arguments.length !== 2) return undefined;
	/* v8 ignore stop -- @preserve */

	const [childrenArgument, targetArgument] = node.arguments;
	/* v8 ignore start -- @preserve two-element argument arrays produce both destructured nodes. */
	if (childrenArgument === undefined || targetArgument === undefined) return undefined;
	/* v8 ignore stop -- @preserve */

	const children = renderPortalChild(childrenArgument, sourceCode);
	return `<${componentName} target={${sourceCode.getText(targetArgument)}}>${children}</${componentName}>`;
}

const preferLocalPortalComponent = createRule("prefer-local-portal-component", "react", {
	create(context): Visitor {
		const { filename, sourceCode } = context;
		const discoverPortal = createLocalComponentDiscoverer(filename, PORTAL_COMPONENT);
		/* v8 ignore next -- @preserve rule harness/runtime filenames are present; empty filename is a defensive host guard. */
		const isPortalDefinitionFile = filename !== "" && inspectLocalComponentFile(filename, PORTAL_COMPONENT).matches;
		const availablePortalIdentifiers = new Set<string>();

		return {
			CallExpression(node): void {
				if (isPortalDefinitionFile) return;
				if (!isPortalFactoryCall(sourceCode, node) || node.arguments.length !== 2) return;

				const hasAvailablePortal = availablePortalIdentifiers.size > 0 || discoverPortal().found;
				if (!hasAvailablePortal) return;

				const canFix = JSX_EXTENSIONS.has(nodePath.extname(filename)) && availablePortalIdentifiers.size === 1;
				const [portalIdentifier] = availablePortalIdentifiers;
				const replacement =
					canFix && portalIdentifier !== undefined
						? getPortalReplacement(portalIdentifier, node, sourceCode)
						: undefined;

				if (replacement !== undefined) {
					context.report({
						fix: (fixer) => fixer.replaceText(node, replacement),
						messageId: "preferPortalComponent",
						node,
					});
					return;
				}

				context.report({
					messageId: "preferPortalComponent",
					node,
				});
			},

			ImportDeclaration(node): void {
				const inspection = inspectRelativeLocalComponentImport(node, filename, PORTAL_COMPONENT);
				addLocalComponentImportIdentifiers(
					node,
					inspection,
					PORTAL_COMPONENT.componentName,
					availablePortalIdentifiers,
				);
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description:
				"Prefer a local Portal component over direct createPortal calls when the project already defines one.",
		},
		fixable: "code",
		messages: {
			preferPortalComponent: "Use the local `Portal` component instead of calling `createPortal` directly.",
		},
		schema: [] as const,
		type: "suggestion",
	},
});

export default preferLocalPortalComponent;
