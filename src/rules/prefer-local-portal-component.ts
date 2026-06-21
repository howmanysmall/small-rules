import { extname } from "node:path";
import { getVariableByName } from "$oxc-utilities/ast-utilities";
import {
	addLocalComponentImportIdentifiers,
	discoverLocalComponent,
	inspectRelativeLocalComponentImport,
} from "$oxc-utilities/local-component-discovery";
import { defineRule } from "oxlint-plugin-utilities";

import type { ScopeVariable } from "$oxc-utilities/ast-utilities";
import type { Definition, ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

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
	return node.parent?.type === "ImportDeclaration" ? node.parent : undefined;
	/* v8 ignore stop -- @preserve */
}

function isCreatePortalImport(variable: ScopeVariable | undefined): boolean {
	if (variable === undefined) return false;

	for (const definition of variable.defs) {
		if (!isImportBindingDefinition(definition) || definition.node.type !== "ImportSpecifier") continue;

		const importDeclaration = getImportDeclarationParent(definition.node);
		if (importDeclaration === undefined || !PORTAL_SOURCES.has(importDeclaration.source.value)) continue;

		const { imported } = definition.node;
		/* v8 ignore next -- @preserve createPortal imports are represented as identifier import specifiers by the parser. */
		if (imported.type === "Identifier" && imported.name === "createPortal") return true;
	}

	return false;
}

function isPortalNamespaceImport(variable: ScopeVariable | undefined): boolean {
	if (variable === undefined) return false;

	for (const definition of variable.defs) {
		if (!isImportBindingDefinition(definition) || definition.node.type !== "ImportNamespaceSpecifier") continue;

		const importDeclaration = getImportDeclarationParent(definition.node);
		/* v8 ignore start -- @preserve namespace import specifier parents are ImportDeclaration nodes in parser output. */
		if (importDeclaration === undefined) continue;
		/* v8 ignore stop -- @preserve */
		if (PORTAL_SOURCES.has(importDeclaration.source.value)) return true;
	}

	return false;
}

function isPortalFactoryCall(sourceCode: SourceCode, { callee }: ESTree.CallExpression): boolean {
	if (callee.type === "Identifier") {
		return isCreatePortalImport(getVariableByName(sourceCode.getScope(callee), callee.name));
	}

	if (
		callee.type !== "MemberExpression" ||
		callee.computed ||
		callee.property.type !== "Identifier" ||
		callee.property.name !== "createPortal" ||
		callee.object.type !== "Identifier"
	) {
		return false;
	}

	const scope = sourceCode.getScope(callee.object);
	return isPortalNamespaceImport(getVariableByName(scope, callee.object.name));
}

function renderPortalChild(argument: ESTree.Node, sourceCode: SourceCode): string {
	if (argument.type === "JSXElement" || argument.type === "JSXFragment") return sourceCode.getText(argument);
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

const preferLocalPortalComponent = defineRule({
	create(context): Visitor {
		const { filename, sourceCode } = context;
		/* v8 ignore start -- @preserve RuleTester/runtime filenames are present; empty filename is a defensive host guard. */
		const discoveredPortal =
			filename === "" ? { found: false } : discoverLocalComponent(filename, PORTAL_COMPONENT);
		/* v8 ignore stop -- @preserve */
		const availablePortalIdentifiers = new Set<string>();

		return {
			CallExpression(node): void {
				if (!isPortalFactoryCall(sourceCode, node) || node.arguments.length !== 2) return;

				const hasAvailablePortal = availablePortalIdentifiers.size > 0 || discoveredPortal.found;
				if (!hasAvailablePortal) return;

				const canFix = JSX_EXTENSIONS.has(extname(filename)) && availablePortalIdentifiers.size === 1;
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
