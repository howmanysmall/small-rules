import { extname } from "node:path";
import { unwrapExpression } from "$oxc-utilities/ast-utilities";
import {
	addLocalComponentImportIdentifiers,
	discoverLocalComponent,
	inspectRelativeLocalComponentImport,
} from "$oxc-utilities/local-component-discovery";
import { isRecord } from "$oxc-utilities/type-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { ESTree, SourceCode, Visitor } from "oxlint-plugin-utilities";

type MessageIds = "preferDirectionalPadding" | "preferEqualPadding";

const IGNORED_COMPARISON_KEYS = new Set(["end", "loc", "parent", "range", "start"]);
const JSX_EXTENSIONS = new Set([".jsx", ".tsx"]);
const PADDING_ATTRIBUTE_NAMES = new Set(["PaddingBottom", "PaddingLeft", "PaddingRight", "PaddingTop"]);

const DIRECTIONAL_PADDING_COMPONENT = {
	componentName: "DirectionalPadding",
	fileNames: ["directional-padding"],
	markers: ["horizontal", "vertical"],
};
const EQUAL_PADDING_COMPONENT = {
	componentName: "EqualPadding",
	fileNames: ["equal-padding"],
	markers: ["padding"],
};

interface PaddingAttributes {
	readonly paddingBottom: ESTree.JSXAttribute;
	readonly paddingLeft: ESTree.JSXAttribute;
	readonly paddingRight: ESTree.JSXAttribute;
	readonly paddingTop: ESTree.JSXAttribute;
}

function areStructurallyEqual(left: unknown, right: unknown): boolean {
	if (Object.is(left, right)) return true;

	if (Array.isArray(left)) {
		return Array.isArray(right) && areArraysStructurallyEqual(left, right);
	}

	/* v8 ignore next -- parser-produced ESTree nodes are records, not native arrays. @preserve */
	if (Array.isArray(right)) return false;

	if (typeof left !== "object" || typeof right !== "object") return false;
	/* v8 ignore next -- comparable JSX values are ESTree node objects, not raw null. @preserve */
	if (left === null || right === null) return false;

	/* v8 ignore next -- comparable JSX values are parser-produced record-shaped ESTree nodes. @preserve */
	if (!(isRecord(left) && isRecord(right))) return false;

	return areRecordsStructurallyEqual(left, right);
}

function areArraysStructurallyEqual(left: ReadonlyArray<unknown>, right: ReadonlyArray<unknown>): boolean {
	if (left.length !== right.length) return false;

	let index = 0;
	for (const value of left) if (!areStructurallyEqual(value, right[index++])) return false;
	return true;
}

function areRecordsStructurallyEqual(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
	const leftEntries = Object.entries(left).filter(([key]) => !IGNORED_COMPARISON_KEYS.has(key));
	const rightEntries = Object.entries(right).filter(([key]) => !IGNORED_COMPARISON_KEYS.has(key));
	if (leftEntries.length !== rightEntries.length) return false;

	for (const [key, value] of leftEntries) {
		/* v8 ignore next -- parser nodes of the same type share required structural keys. @preserve */
		if (!(key in right)) return false;
		if (!areStructurallyEqual(value, right[key])) return false;
	}

	return true;
}

function hasMeaningfulChildren(node: ESTree.JSXElement): boolean {
	for (const child of node.children) {
		if (child.type === "JSXText" && child.value.trim() === "") continue;
		if (child.type === "JSXExpressionContainer" && child.expression.type === "JSXEmptyExpression") continue;

		return true;
	}

	return false;
}

function getComparableAttributeNode({ value }: ESTree.JSXAttribute): ESTree.Expression | undefined {
	/* v8 ignore next -- collectPaddingAttributes rejects padding attributes without values. @preserve */
	if (value === null) return undefined;

	if (value.type === "JSXExpressionContainer") {
		switch (value.expression.type) {
			case "JSXElement":
			case "JSXEmptyExpression":
			case "JSXFragment":
				return undefined;

			default:
				return unwrapExpression(value.expression);
		}
	}

	return value.type === "Literal" ? value : undefined;
}

function collectPaddingAttributes(node: ESTree.JSXOpeningElement): PaddingAttributes | undefined {
	const attributes = new Map<string, ESTree.JSXAttribute>();

	for (const attribute of node.attributes) {
		if (attribute.type === "JSXSpreadAttribute" || attribute.name.type !== "JSXIdentifier") return undefined;

		const attributeName = attribute.name.name;
		if (!PADDING_ATTRIBUTE_NAMES.has(attributeName) || attributes.has(attributeName) || attribute.value === null) {
			return undefined;
		}

		attributes.set(attributeName, attribute);
	}

	const paddingBottom = attributes.get("PaddingBottom");
	const paddingLeft = attributes.get("PaddingLeft");
	const paddingRight = attributes.get("PaddingRight");
	const paddingTop = attributes.get("PaddingTop");
	if (
		paddingBottom === undefined ||
		paddingLeft === undefined ||
		paddingRight === undefined ||
		paddingTop === undefined
	) {
		return undefined;
	}

	return { paddingBottom, paddingLeft, paddingRight, paddingTop };
}

function getAttributeValueText({ value }: ESTree.JSXAttribute, sourceCode: SourceCode): string | undefined {
	/* v8 ignore next -- collectPaddingAttributes rejects padding attributes without values. @preserve */
	if (value === null) return undefined;

	switch (value.type) {
		case "JSXExpressionContainer":
		case "Literal":
			return sourceCode.getText(value);

		/* v8 ignore next -- comparable attributes exclude JSX/direct non-literal values before fixes. @preserve */
		default:
			return undefined;
	}
}

function getPaddingReplacement(
	componentName: string,
	kind: MessageIds,
	attributes: PaddingAttributes,
	sourceCode: SourceCode,
): string | undefined {
	const topValue = getAttributeValueText(attributes.paddingTop, sourceCode);
	/* v8 ignore next -- reported padding has a comparable top value that can be printed. @preserve */
	if (topValue === undefined) return undefined;

	if (kind === "preferEqualPadding") return `<${componentName} padding=${topValue} />`;

	const leftValue = getAttributeValueText(attributes.paddingLeft, sourceCode);
	/* v8 ignore next -- directional reports require a comparable left value that can be printed. @preserve */
	if (leftValue === undefined) return undefined;

	return `<${componentName} horizontal=${topValue} vertical=${leftValue} />`;
}

function getPaddingMessageId(attributes: PaddingAttributes): MessageIds | undefined {
	const bottom = getComparableAttributeNode(attributes.paddingBottom);
	const left = getComparableAttributeNode(attributes.paddingLeft);
	const right = getComparableAttributeNode(attributes.paddingRight);
	const top = getComparableAttributeNode(attributes.paddingTop);
	if (bottom === undefined || left === undefined || right === undefined || top === undefined) return undefined;

	const allEqual =
		areStructurallyEqual(top, bottom) && areStructurallyEqual(top, left) && areStructurallyEqual(top, right);
	if (allEqual) return "preferEqualPadding";

	const horizontalEqual = areStructurallyEqual(top, bottom);
	const verticalEqual = areStructurallyEqual(left, right);
	return horizontalEqual && verticalEqual ? "preferDirectionalPadding" : undefined;
}

function isJsxIdentifier(node: ESTree.JSXElementName): node is ESTree.JSXIdentifier {
	return node.type === "JSXIdentifier";
}

const preferPaddingComponents = defineRule({
	create(context): Visitor {
		const { filename } = context;
		/* v8 ignore start -- @preserve rule execution supplies a filename before local component discovery. */
		const discoveredDirectionalPadding =
			filename === "" ? { found: false } : discoverLocalComponent(filename, DIRECTIONAL_PADDING_COMPONENT);
		const discoveredEqualPadding =
			filename === "" ? { found: false } : discoverLocalComponent(filename, EQUAL_PADDING_COMPONENT);
		/* v8 ignore stop -- @preserve */
		const directionalPaddingIdentifiers = new Set<string>();
		const equalPaddingIdentifiers = new Set<string>();

		return {
			ImportDeclaration(node): void {
				const directionalInspection = inspectRelativeLocalComponentImport(
					node,
					filename,
					DIRECTIONAL_PADDING_COMPONENT,
				);
				const equalInspection = inspectRelativeLocalComponentImport(node, filename, EQUAL_PADDING_COMPONENT);
				addLocalComponentImportIdentifiers(
					node,
					directionalInspection,
					DIRECTIONAL_PADDING_COMPONENT.componentName,
					directionalPaddingIdentifiers,
				);
				addLocalComponentImportIdentifiers(
					node,
					equalInspection,
					EQUAL_PADDING_COMPONENT.componentName,
					equalPaddingIdentifiers,
				);
			},

			JSXElement(node): void {
				if (hasMeaningfulChildren(node)) return;

				const { openingElement } = node;
				if (!isJsxIdentifier(openingElement.name)) return;
				if (openingElement.name.name !== "uipadding") return;

				const attributes = collectPaddingAttributes(openingElement);
				if (attributes === undefined) return;

				const messageId = getPaddingMessageId(attributes);
				if (messageId === undefined) return;
				const componentIdentifiers =
					messageId === "preferEqualPadding" ? equalPaddingIdentifiers : directionalPaddingIdentifiers;
				const discoveredComponent =
					messageId === "preferEqualPadding" ? discoveredEqualPadding : discoveredDirectionalPadding;

				if (componentIdentifiers.size === 0 && !discoveredComponent.found) return;

				const canFix = JSX_EXTENSIONS.has(extname(filename)) && componentIdentifiers.size === 1;
				const [componentIdentifier] = [...componentIdentifiers];
				const replacement =
					canFix && componentIdentifier !== undefined
						? getPaddingReplacement(componentIdentifier, messageId, attributes, context.sourceCode)
						: undefined;

				if (replacement !== undefined) {
					context.report({
						fix(fixer) {
							return fixer.replaceText(node, replacement);
						},
						messageId,
						node,
					});
					return;
				}

				context.report({ messageId, node });
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description:
				"Prefer local EqualPadding and DirectionalPadding components over matching <uipadding /> declarations.",
		},
		fixable: "code",
		messages: {
			preferDirectionalPadding:
				"Use the local `DirectionalPadding` component when horizontal and vertical padding already match.",
			preferEqualPadding: "Use the local `EqualPadding` component when all four padding values already match.",
		},
		schema: [] as const,
		type: "suggestion",
	},
});

export default preferPaddingComponents;
