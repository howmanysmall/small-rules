import nodePath from "node:path";
import { isJsxElement, isJsxFragment } from "@small-rules/oxlint-utilities";

import { createRule } from "$oxc-utilities/create-rule";
import { isImportedCallee } from "$oxc-utilities/import-binding-provenance";
import {
	addLocalComponentImportIdentifiers,
	createLocalComponentDiscoverer,
	inspectLocalComponentFile,
	inspectRelativeLocalComponentImport,
} from "$oxc-utilities/local-component-discovery";
import { reportWithReplacement } from "$oxc-utilities/replacement-report";

import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

const PORTAL_COMPONENT = {
	componentName: "Portal",
	fileNames: ["portal"],
	markers: ["target"],
};
const PORTAL_SOURCES = new Set(["@rbxts/react-roblox", "react-dom"]);
const JSX_EXTENSIONS = new Set([".jsx", ".tsx"]);

function isPortalFactoryCall(sourceCode: SourceCode, { callee }: ESTree.CallExpression): boolean {
	return isImportedCallee(sourceCode, callee, PORTAL_SOURCES, "createPortal");
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
		const isPortalDefinitionFile =
			filename.length > 0 && inspectLocalComponentFile(filename, PORTAL_COMPONENT).matches;
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

				reportWithReplacement(context, "preferPortalComponent", node, replacement);
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
