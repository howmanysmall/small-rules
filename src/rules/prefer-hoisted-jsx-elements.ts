import { getVariableByName } from "$oxc-utilities/ast-utilities";
import { isHoistableJSXElementName } from "$oxc-utilities/component-utilities";
import {
	DEFAULT_STATIC_GLOBAL_FACTORIES,
	getModuleConstInitializer,
	isExplicitUndefinedExpression,
	isModuleLevelScope,
	isStaticExpression,
} from "$oxc-utilities/static-expression-utilities";
import { isRecord, isStringArray } from "$oxc-utilities/type-utilities";
import { defineRule } from "oxlint-plugin-utilities";

import type { StaticExpressionOptions } from "$oxc-utilities/static-expression-utilities";
import type { ESTree, InferContextFromRule, Visitor } from "oxlint-plugin-utilities";

function normalizeAdditionalHoistableComponents(rawOptions: unknown): ReadonlySet<string> {
	if (!(isRecord(rawOptions) && "additionalHoistableComponents" in rawOptions)) return new Set();

	const { additionalHoistableComponents } = rawOptions;
	if (additionalHoistableComponents === undefined || !isStringArray(additionalHoistableComponents)) {
		return new Set();
	}

	return new Set(additionalHoistableComponents);
}

function normalizeAdditionalStaticFactories(rawOptions: unknown): ReadonlySet<string> {
	if (!(isRecord(rawOptions) && "additionalStaticFactories" in rawOptions)) return new Set();

	const { additionalStaticFactories } = rawOptions;
	if (additionalStaticFactories === undefined || !isStringArray(additionalStaticFactories)) {
		return new Set();
	}

	return new Set(additionalStaticFactories);
}

function isJavaScriptXmlElementAssignedToModuleConst(context: Context, node: ESTree.JSXElement): boolean {
	const { parent } = node;
	if (parent.type !== "VariableDeclarator" || parent.id.type !== "Identifier" || parent.init !== node) {
		return false;
	}

	const variable = getVariableByName(context.sourceCode.getScope(node), parent.id.name);
	return variable === undefined ? false : isModuleLevelScope(variable.scope);
}

function isStaticAttributeValue(
	context: Context,
	attribute: ESTree.JSXAttribute,
	seen: Set<ESTree.Node>,
	staticOptions: StaticExpressionOptions,
): boolean {
	if (
		attribute.name.type === "JSXIdentifier" &&
		(attribute.name.name === "Event" || attribute.name.name === "Change")
	) {
		return false;
	}

	const { value } = attribute;
	if (value === null || value.type === "Literal") return true;
	if (
		value.type !== "JSXExpressionContainer" ||
		value.expression.type === "JSXEmptyExpression" ||
		isExplicitUndefinedExpression(context.sourceCode, value.expression, new Set())
	) {
		return false;
	}

	return isStaticExpression(context.sourceCode, value.expression, seen, staticOptions);
}

function hasStaticAttributes(
	context: Context,
	node: ESTree.JSXOpeningElement,
	seen: Set<ESTree.Node>,
	staticOptions: StaticExpressionOptions,
): boolean {
	for (const attribute of node.attributes) {
		if (
			attribute.type === "JSXSpreadAttribute" ||
			!isStaticAttributeValue(context, attribute, seen, staticOptions)
		) {
			return false;
		}
	}

	return true;
}

function isStaticJavaScriptXmlChild(
	context: Context,
	child: ESTree.JSXChild,
	seen: Set<ESTree.Node>,
	additionalComponents: ReadonlySet<string>,
	staticOptions: StaticExpressionOptions,
): boolean {
	if (child.type === "JSXText") return child.value.trim() === "";
	if (child.type === "JSXElement") {
		return isStaticRobloxElement(context, child, seen, additionalComponents, staticOptions);
	}
	if (child.type !== "JSXExpressionContainer") return false;
	if (child.expression.type === "JSXEmptyExpression") return true;

	if (child.expression.type === "Identifier") {
		const initializer = getModuleConstInitializer(context.sourceCode, child.expression);
		if (initializer?.type === "JSXElement") {
			return isStaticRobloxElement(context, initializer, seen, additionalComponents, staticOptions);
		}
	}

	return isStaticExpression(context.sourceCode, child.expression, seen, staticOptions);
}

function hasStaticChildren(
	context: Context,
	node: ESTree.JSXElement,
	seen: Set<ESTree.Node>,
	additionalComponents: ReadonlySet<string>,
	staticOptions: StaticExpressionOptions,
): boolean {
	for (const child of node.children) {
		if (!isStaticJavaScriptXmlChild(context, child, seen, additionalComponents, staticOptions)) return false;
	}

	return true;
}

function isStaticRobloxElement(
	context: Context,
	node: ESTree.JSXElement,
	seen: Set<ESTree.Node>,
	additionalComponents: ReadonlySet<string>,
	staticOptions: StaticExpressionOptions,
): boolean {
	return (
		isHoistableJSXElementName(node.openingElement.name, additionalComponents) &&
		hasStaticAttributes(context, node.openingElement, seen, staticOptions) &&
		hasStaticChildren(context, node, seen, additionalComponents, staticOptions)
	);
}

function hasStaticRobloxAncestor(
	context: Context,
	node: ESTree.JSXElement,
	additionalComponents: ReadonlySet<string>,
	staticOptions: StaticExpressionOptions,
): boolean {
	let { parent } = node;
	while (parent.type !== "Program") {
		if (
			parent.type === "JSXElement" &&
			isStaticRobloxElement(context, parent, new Set(), additionalComponents, staticOptions)
		) {
			return true;
		}
		({ parent } = parent);
	}

	return false;
}

function isInsideHoistedJsxElement(context: Context, node: ESTree.JSXElement): boolean {
	let current: ESTree.Node = node;
	let { parent } = current;
	while (parent.type !== "Program") {
		if (parent.type === "VariableDeclarator" && parent.id.type === "Identifier" && parent.init === current) {
			const variable = getVariableByName(context.sourceCode.getScope(current), parent.id.name);
			if (variable !== undefined && isModuleLevelScope(variable.scope)) {
				return true;
			}
		}
		if (parent.type === "JSXElement" || parent.type === "JSXFragment") {
			current = parent;
		}
		({ parent } = parent);
	}
	return false;
}

function reportHoistableJavaScriptXmlElement(context: Context, node: ESTree.JSXElement): void {
	const elementText = context.sourceCode.getText(node);
	context.report({
		data: { elementText },
		messageId: "hoistableJsxElement",
		node,
	});
}

const preferHoistedJsxElements = defineRule({
	create(context): Visitor {
		const [rawOptions] = context.options;
		const additionalComponents = normalizeAdditionalHoistableComponents(rawOptions);
		const additionalStaticFactories = normalizeAdditionalStaticFactories(rawOptions);

		const staticOptions: StaticExpressionOptions = {
			staticGlobalFactories: new Set([...DEFAULT_STATIC_GLOBAL_FACTORIES, ...additionalStaticFactories]),
		};

		return {
			JSXElement(node): void {
				if (!isStaticRobloxElement(context, node, new Set(), additionalComponents, staticOptions)) return;
				if (isJavaScriptXmlElementAssignedToModuleConst(context, node)) return;
				if (hasStaticRobloxAncestor(context, node, additionalComponents, staticOptions)) return;
				if (isInsideHoistedJsxElement(context, node)) return;

				reportHoistableJavaScriptXmlElement(context, node);
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Prefer extracting static Roblox JSX intrinsic elements to module-level constants.",
		},
		messages: {
			hoistableJsxElement:
				"Extract `{{elementText}}` to a shared module-level const — this Roblox JSX element is fully static and identical elements should reuse the same const.",
		},
		schema: [
			{
				additionalProperties: false,
				properties: {
					additionalHoistableComponents: {
						description: "Additional component names that can be hoisted to module-level constants.",
						items: { type: "string" },
						type: "array",
					},
					additionalStaticFactories: {
						description: "Additional factory functions whose return values are considered static.",
						items: { type: "string" },
						type: "array",
					},
				},
				type: "object",
			},
		],
		type: "suggestion",
	},
});
type Context = InferContextFromRule<typeof preferHoistedJsxElements>;

export default preferHoistedJsxElements;
