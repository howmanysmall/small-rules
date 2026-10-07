import {
	ARRAY_EXPRESSION,
	isAnyLiteral,
	isIdentifier,
	isJsxElement,
	isJsxEmptyExpression,
	isJsxExpressionContainer,
	isJsxFragment,
	isJsxIdentifier,
	isJsxMemberExpression,
	isJsxSpreadAttribute,
	isJsxText,
	isProgram,
	isVariableDeclaration,
	isVariableDeclarator,
	OBJECT_EXPRESSION,
	PARENTHESIZED_EXPRESSION,
	PROPERTY,
	TS_AS_EXPRESSION,
	TS_INSTANTIATION_EXPRESSION,
	TS_NON_NULL_EXPRESSION,
	TS_SATISFIES_EXPRESSION,
	TS_TYPE_ASSERTION,
} from "@small-rules/oxlint-utilities";
import { Predicate } from "effect";

import { getVariableByName } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import { stripExpressionWrappers } from "$oxc-utilities/oxc-utilities";
import { ENVIRONMENT_SCHEMA, getEnvironment, ROBLOX_TS, STANDARD } from "$oxc-utilities/react-utilities";
import {
	DEFAULT_STATIC_GLOBAL_FACTORIES,
	getConstInitializer,
	getModuleConstInitializer,
	isExplicitUndefinedExpression,
	isImportBinding,
	isModuleLevelScope,
	isStaticExpression,
} from "$oxc-utilities/static-expression-utilities";
import { isStringArray } from "$oxc-utilities/type-utilities";

import type { ESTree, InferContextFromRule, Visitor } from "oxlint-plugin-utilities";

import type { Environment } from "$oxc-utilities/react-utilities";
import type { StaticExpressionOptions } from "$oxc-utilities/static-expression-utilities";

type JavaScriptXmlNode = ESTree.JSXElement | ESTree.JSXFragment;

function normalizeAdditionalHoistableComponents(rawOptions: Context["options"][0]): ReadonlySet<string> {
	if (!Predicate.isObject(rawOptions) || !("additionalHoistableComponents" in rawOptions)) return new Set();

	const { additionalHoistableComponents } = rawOptions;
	/* v8 ignore start -- @preserve rule schema rejects non-array additionalHoistableComponents values. */
	if (!isStringArray(additionalHoistableComponents)) return new Set();
	/* v8 ignore stop -- @preserve */

	return new Set(additionalHoistableComponents);
}

function normalizeAdditionalStaticFactories(rawOptions: Context["options"][0]): ReadonlySet<string> {
	if (!Predicate.isObject(rawOptions) || !("additionalStaticFactories" in rawOptions)) return new Set();

	const { additionalStaticFactories } = rawOptions;
	/* v8 ignore start -- @preserve rule schema rejects non-array additionalStaticFactories values. */
	if (!isStringArray(additionalStaticFactories)) return new Set();
	/* v8 ignore stop -- @preserve */

	return new Set(additionalStaticFactories);
}

function getJavaScriptXmlElementRootName(name: ESTree.JSXElementName): string | undefined {
	let current = name;
	while (isJsxMemberExpression(current)) current = current.object;
	return isJsxIdentifier(current) ? current.name : undefined;
}

function isStableModuleComponentName(context: Context, node: ESTree.JSXElement, name: string): boolean {
	const variable = getVariableByName(context.sourceCode.getScope(node), name);
	if (variable === undefined || !isModuleLevelScope(variable.scope)) return false;
	if (isImportBinding(variable)) return true;

	for (const definition of variable.defs) {
		if (definition.type === "FunctionName" || definition.type === "ClassName") return true;
		if (getConstInitializer(definition) !== undefined) return true;
	}

	return false;
}

function isImportedJavaScriptXmlNamespace(context: Context, node: ESTree.JSXElement, name: string): boolean {
	const variable = getVariableByName(context.sourceCode.getScope(node), name);
	return variable !== undefined && isImportBinding(variable);
}

function isHoistableJavaScriptXmlElementName(
	context: Context,
	node: ESTree.JSXElement,
	additionalComponents: ReadonlySet<string>,
	environment: Environment,
): boolean {
	const { name } = node.openingElement;
	if (isJsxIdentifier(name)) {
		const firstCharacter = name.name.charAt(0);
		if (firstCharacter !== "" && firstCharacter === firstCharacter.toLowerCase()) return true;
	}

	const rootName = getJavaScriptXmlElementRootName(name);
	if (rootName === undefined) return false;

	const variable = getVariableByName(context.sourceCode.getScope(node), rootName);
	const isMemberName = isJsxMemberExpression(name);
	if (additionalComponents.has(rootName)) {
		if (variable === undefined) return !isMemberName;
		return isMemberName
			? isImportedJavaScriptXmlNamespace(context, node, rootName)
			: isStableModuleComponentName(context, node, rootName);
	}

	if (environment !== STANDARD) return false;
	return isMemberName
		? isImportedJavaScriptXmlNamespace(context, node, rootName)
		: isStableModuleComponentName(context, node, rootName);
}

function isStaticAttributeValue(
	context: Context,
	attribute: ESTree.JSXAttribute,
	seen: Set<ESTree.Node>,
	staticOptions: StaticExpressionOptions,
	environment: Environment,
): boolean {
	if (
		environment === ROBLOX_TS &&
		isJsxIdentifier(attribute.name) &&
		(attribute.name.name === "Event" || attribute.name.name === "Change")
	) {
		return false;
	}

	const { value } = attribute;
	if (value === null || isAnyLiteral(value)) return true;
	/* v8 ignore next -- @preserve parser JSX attributes have non-empty expression containers here. */
	if (!isJsxExpressionContainer(value) || isJsxEmptyExpression(value.expression)) return false;

	if (isExplicitUndefinedExpression(context.sourceCode, value.expression, new Set())) {
		return environment === STANDARD;
	}

	return isStaticExpression(context.sourceCode, value.expression, seen, staticOptions);
}

function hasStaticAttributes(
	context: Context,
	node: ESTree.JSXOpeningElement,
	seen: Set<ESTree.Node>,
	staticOptions: StaticExpressionOptions,
	environment: Environment,
): boolean {
	for (const attribute of node.attributes) {
		if (
			isJsxSpreadAttribute(attribute) ||
			!isStaticAttributeValue(context, attribute, new Set(seen), staticOptions, environment)
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
	environment: Environment,
): boolean {
	if (isJsxText(child)) return environment === STANDARD || child.value.trim().length === 0;
	if (isJsxElement(child) || isJsxFragment(child)) {
		return isStaticJavaScriptXmlNode(
			context,
			child,
			new Set(seen),
			additionalComponents,
			staticOptions,
			environment,
		);
	}
	if (!isJsxExpressionContainer(child)) return false;
	if (isJsxEmptyExpression(child.expression)) return true;
	if (isJsxElement(child.expression) || isJsxFragment(child.expression)) {
		return isStaticJavaScriptXmlNode(
			context,
			child.expression,
			new Set(seen),
			additionalComponents,
			staticOptions,
			environment,
		);
	}

	if (isIdentifier(child.expression)) {
		const initializer = getModuleConstInitializer(context.sourceCode, child.expression);
		if (initializer !== undefined) {
			const unwrappedInitializer = stripExpressionWrappers(initializer);
			if (isJsxElement(unwrappedInitializer) || isJsxFragment(unwrappedInitializer)) {
				return isStaticJavaScriptXmlNode(
					context,
					unwrappedInitializer,
					new Set(seen),
					additionalComponents,
					staticOptions,
					environment,
				);
			}
		}
	}

	return isStaticExpression(context.sourceCode, child.expression, new Set(seen), staticOptions);
}

function hasStaticChildren(
	context: Context,
	node: JavaScriptXmlNode,
	seen: Set<ESTree.Node>,
	additionalComponents: ReadonlySet<string>,
	staticOptions: StaticExpressionOptions,
	environment: Environment,
): boolean {
	for (const child of node.children) {
		if (
			!isStaticJavaScriptXmlChild(context, child, new Set(seen), additionalComponents, staticOptions, environment)
		) {
			return false;
		}
	}

	return true;
}

function isStaticJavaScriptXmlNode(
	context: Context,
	node: JavaScriptXmlNode,
	seen: Set<ESTree.Node>,
	additionalComponents: ReadonlySet<string>,
	staticOptions: StaticExpressionOptions,
	environment: Environment,
): boolean {
	if (seen.has(node)) return false;
	seen.add(node);

	if (isJsxFragment(node)) {
		return hasStaticChildren(context, node, seen, additionalComponents, staticOptions, environment);
	}

	return (
		isHoistableJavaScriptXmlElementName(context, node, additionalComponents, environment) &&
		hasStaticAttributes(context, node.openingElement, seen, staticOptions, environment) &&
		hasStaticChildren(context, node, seen, additionalComponents, staticOptions, environment)
	);
}

function hasStaticJavaScriptXmlAncestor(
	context: Context,
	node: JavaScriptXmlNode,
	additionalComponents: ReadonlySet<string>,
	staticOptions: StaticExpressionOptions,
	environment: Environment,
): boolean {
	// oxlint-disable-next-line flawless/prefer-parameter-destructuring -- rule conflict.
	let { parent } = node;
	while (!isProgram(parent)) {
		if (
			(isJsxElement(parent) || isJsxFragment(parent)) &&
			isStaticJavaScriptXmlNode(context, parent, new Set(), additionalComponents, staticOptions, environment)
		) {
			return true;
		}
		({ parent } = parent);
	}

	return false;
}

function isTransparentExpressionWrapper(parent: ESTree.Node, child: ESTree.Node): boolean {
	switch (parent.type) {
		case PARENTHESIZED_EXPRESSION:
		case TS_AS_EXPRESSION:
		case TS_INSTANTIATION_EXPRESSION:
		case TS_NON_NULL_EXPRESSION:
		case TS_SATISFIES_EXPRESSION:
		case TS_TYPE_ASSERTION:
			return parent.expression === child;

		default:
			return false;
	}
}

function isTransparentJavaScriptXmlContainer(parent: ESTree.Node, child: ESTree.Node): boolean {
	if (isJsxElement(parent) || isJsxFragment(parent)) return true;
	return isJsxExpressionContainer(parent) && parent.expression === child;
}

function isTransparentInitializerParent(parent: ESTree.Node, child: ESTree.Node): boolean {
	if (isTransparentExpressionWrapper(parent, child) || isTransparentJavaScriptXmlContainer(parent, child)) {
		return true;
	}

	switch (parent.type) {
		case ARRAY_EXPRESSION:
		case OBJECT_EXPRESSION:
			return true;

		case PROPERTY:
			return parent.value === child;

		default:
			return false;
	}
}

function isAssignedToModuleConst(context: Context, node: JavaScriptXmlNode): boolean {
	let current: ESTree.Node = node;
	let { parent } = current;
	while (isTransparentInitializerParent(parent, current)) {
		current = parent;
		const { parent: nextParent } = current;
		/* v8 ignore next -- @preserve parser JSX nodes have parents up to Program. */
		if (nextParent === null) return false;
		parent = nextParent;
	}

	if (!isVariableDeclarator(parent) || !isIdentifier(parent.id) || parent.init !== current) {
		return false;
	}
	/* v8 ignore next -- @preserve VariableDeclarator nodes are parented by VariableDeclaration nodes. */
	if (!isVariableDeclaration(parent.parent)) return false;
	if (parent.parent.kind !== "const") return false;

	const variable = getVariableByName(context.sourceCode.getScope(current), parent.id.name);
	return variable !== undefined && isModuleLevelScope(variable.scope);
}

function reportHoistableJavaScriptXmlNode(context: Context, node: JavaScriptXmlNode): void {
	const elementText = context.sourceCode.getText(node);
	context.report({
		data: { elementText },
		messageId: "hoistableJsxElement",
		node,
	});
}

const preferHoistedJsxElements = createRule("prefer-hoisted-jsx-elements", "react", {
	create(context): Visitor {
		const [rawOptions] = context.options;
		const additionalComponents = normalizeAdditionalHoistableComponents(rawOptions);
		const additionalStaticFactories = normalizeAdditionalStaticFactories(rawOptions);
		const environment = getEnvironment(rawOptions);
		const defaultStaticFactories = environment === ROBLOX_TS ? DEFAULT_STATIC_GLOBAL_FACTORIES : [];

		const staticOptions: StaticExpressionOptions = {
			staticCallsRequireFactories: true,
			staticGlobalFactories: new Set([...defaultStaticFactories, ...additionalStaticFactories]),
		};

		function checkJavaScriptXmlNode(node: JavaScriptXmlNode): void {
			if (
				!isStaticJavaScriptXmlNode(context, node, new Set(), additionalComponents, staticOptions, environment)
			) {
				return;
			}
			if (isAssignedToModuleConst(context, node)) return;
			if (hasStaticJavaScriptXmlAncestor(context, node, additionalComponents, staticOptions, environment)) {
				return;
			}

			reportHoistableJavaScriptXmlNode(context, node);
		}

		return {
			JSXElement: checkJavaScriptXmlNode,
			JSXFragment: checkJavaScriptXmlNode,
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description: "Prefer extracting static JSX elements to module-level constants.",
		},
		messages: {
			hoistableJsxElement:
				"Extract `{{elementText}}` to a shared module-level const — this JSX element is fully static and identical elements should reuse the same const.",
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
					environment: ENVIRONMENT_SCHEMA,
				},
				type: "object",
			},
		],
		type: "suggestion",
	},
});
type Context = InferContextFromRule<typeof preferHoistedJsxElements>;

export default preferHoistedJsxElements;
