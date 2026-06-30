import { extname } from "node:path";
import {
	addLocalComponentImportIdentifiers,
	discoverLocalComponent,
	inspectRelativeLocalComponentImport,
} from "$oxc-utilities/local-component-discovery";
import { defineRule } from "oxlint-plugin-utilities";

import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

const CONTEXT_STACK_COMPONENT = {
	componentName: "ContextStack",
	fileNames: ["context-stack"],
	markers: ["providers"],
};
const JSX_EXTENSIONS = new Set([".jsx", ".tsx"]);

function isProviderElement(node: ESTree.JSXElement): boolean {
	return (
		node.openingElement.name.type === "JSXMemberExpression" && node.openingElement.name.property.name === "Provider"
	);
}

function getMeaningfulChildren(node: ESTree.JSXElement): ReadonlyArray<ESTree.JSXChild> {
	return node.children.filter((child) => {
		if (child.type === "JSXText") return child.value.trim() !== "";
		if (child.type === "JSXExpressionContainer") return child.expression.type !== "JSXEmptyExpression";
		return true;
	});
}

function isNestedProviderInChain(node: ESTree.JSXElement): boolean {
	const { parent } = node;
	if (parent.type !== "JSXElement" || !isProviderElement(parent)) return false;

	const meaningfulChildren = getMeaningfulChildren(parent);
	return meaningfulChildren.length === 1 && meaningfulChildren[0] === node;
}

function collectProviderChain(node: ESTree.JSXElement): ReadonlyArray<ESTree.JSXElement> | undefined {
	if (!isProviderElement(node)) return undefined;

	const chain = [node];
	let current = node;

	while (true) {
		const meaningfulChildren = getMeaningfulChildren(current);
		if (meaningfulChildren.length !== 1) break;

		const [child] = meaningfulChildren;
		if (child?.type !== "JSXElement" || !isProviderElement(child)) break;

		chain.push(child);
		current = child;
	}

	return chain.length > 1 ? chain : undefined;
}

function hasOnlySafeWrapperChildren(node: ESTree.JSXElement, nextProvider: ESTree.JSXElement): boolean {
	let sawNextProvider = false;

	for (const child of node.children) {
		if (child === nextProvider) {
			sawNextProvider = true;
			continue;
		}

		/* v8 ignore next -- @preserve provider-chain children are only the next provider plus parser whitespace. */
		if (child.type === "JSXText" && child.value.trim() === "") continue;
		return false;
	}

	return sawNextProvider;
}

function isSafelyFixableProviderChain(chain: ReadonlyArray<ESTree.JSXElement>): boolean {
	let index = 0;
	for (const provider of chain) {
		const nextProvider = chain[index + 1];
		if (nextProvider === undefined) {
			index += 1;
			continue;
		}
		if (!hasOnlySafeWrapperChildren(provider, nextProvider)) return false;
		index += 1;
	}

	return true;
}

function getSelfClosingProviderText(element: ESTree.JSXElement, sourceCode: SourceCode): string | undefined {
	const openingText = sourceCode.getText(element.openingElement);
	/* v8 ignore start -- @preserve provider chains cannot continue through self-closing providers. */
	if (element.openingElement.selfClosing) return openingText;
	/* v8 ignore stop -- @preserve */
	/* v8 ignore start -- @preserve JSX opening element text from the parser ends with ">". */
	return openingText.endsWith(">") ? `${openingText.slice(0, -1)} />` : undefined;
	/* v8 ignore stop -- @preserve */
}

function getContextStackReplacement(
	componentName: string,
	chain: ReadonlyArray<ESTree.JSXElement>,
	sourceCode: SourceCode,
): string | undefined {
	const providers = new Array<string>();
	for (const provider of chain) {
		const providerText = getSelfClosingProviderText(provider, sourceCode);
		/* v8 ignore next -- @preserve provider text comes from parser opening elements that end with ">". */
		if (providerText === undefined) return undefined;
		providers.push(providerText);
	}

	const innermostProvider = chain.at(-1);
	/* v8 ignore start -- @preserve collected provider chains are nonempty and nested providers have closing elements. */
	// oxlint-disable-next-line typescript/prefer-optional-chain -- not the same.
	if (innermostProvider === undefined || innermostProvider.closingElement === null) return undefined;
	/* v8 ignore stop -- @preserve */

	const children = sourceCode.text.slice(
		innermostProvider.openingElement.range[1],
		innermostProvider.closingElement.range[0],
	);
	return `<${componentName} providers={[${providers.join(", ")}]}>${children}</${componentName}>`;
}

const preferContextStack = defineRule({
	create(context): Visitor {
		const { filename, sourceCode } = context;
		/* v8 ignore start -- @preserve rule harness/runtime filenames are present; empty filename is a defensive host guard. */
		const discoveredContextStack =
			filename === "" ? { found: false } : discoverLocalComponent(filename, CONTEXT_STACK_COMPONENT);
		/* v8 ignore stop -- @preserve */
		const contextStackIdentifiers = new Set<string>();

		return {
			ImportDeclaration(node): void {
				const inspection = inspectRelativeLocalComponentImport(node, filename, CONTEXT_STACK_COMPONENT);
				addLocalComponentImportIdentifiers(
					node,
					inspection,
					CONTEXT_STACK_COMPONENT.componentName,
					contextStackIdentifiers,
				);
			},

			JSXElement(node): void {
				if (isNestedProviderInChain(node)) return;

				const providerChain = collectProviderChain(node);
				if (
					providerChain === undefined ||
					(contextStackIdentifiers.size === 0 && !discoveredContextStack.found)
				) {
					return;
				}

				const canFix =
					JSX_EXTENSIONS.has(extname(filename)) &&
					contextStackIdentifiers.size === 1 &&
					isSafelyFixableProviderChain(providerChain);

				const [contextStackIdentifier] = contextStackIdentifiers;
				const replacement =
					canFix && contextStackIdentifier !== undefined
						? getContextStackReplacement(contextStackIdentifier, providerChain, sourceCode)
						: undefined;

				if (replacement !== undefined) {
					context.report({
						fix: (fixer) => fixer.replaceText(node, replacement),
						messageId: "preferContextStack",
						node,
					});
					return;
				}

				context.report({
					messageId: "preferContextStack",
					node,
				});
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Prefer a local ContextStack component over directly nesting multiple context providers.",
		},
		fixable: "code",
		messages: {
			preferContextStack:
				"Use the local `ContextStack` component instead of nesting multiple context providers directly.",
		},
		schema: [] as const,
		type: "suggestion",
	},
});

export default preferContextStack;
