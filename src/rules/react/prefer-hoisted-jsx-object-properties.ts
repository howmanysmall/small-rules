import { getVariableByName } from "$oxc-utilities/ast-utilities";
import { createRule } from "$oxc-utilities/create-rule";
import {
	ARRAY_EXPRESSION,
	isIdentifierName,
	isJsxElement,
	isJsxEmptyExpression,
	isJsxExpressionContainer,
	isJsxOpeningElement,
	isObjectExpression,
	isProperty,
	isVariableDeclarator,
	JSX_ELEMENT,
	JSX_EXPRESSION_CONTAINER,
	JSX_FRAGMENT,
	PARENTHESIZED_EXPRESSION,
	unwrapExpression,
} from "$oxc-utilities/oxc-utilities";
import {
	DEFAULT_STATIC_GLOBAL_FACTORIES,
	isModuleLevelScope,
	isStaticExpression,
} from "$oxc-utilities/static-expression-utilities";

import type { Context, ESTree, Visitor } from "oxlint-plugin-utilities";

import type { NodeType } from "$oxc-utilities/oxc-utilities";
import type { StaticExpressionOptions } from "$oxc-utilities/static-expression-utilities";

const STATIC_OPTIONS: StaticExpressionOptions = {
	staticGlobalFactories: new Set(DEFAULT_STATIC_GLOBAL_FACTORIES),
};

function getAttributeExpression({ value }: ESTree.JSXAttribute): ESTree.Expression | undefined {
	if (!isJsxExpressionContainer(value)) return undefined;
	/* v8 ignore next -- @preserve Oxc only produces JSXEmptyExpression here for rejected parse-error cases. */
	return isJsxEmptyExpression(value.expression) ? undefined : value.expression;
}

const WALKABLE_JSX_PARENTS = new Set<NodeType>([
	JSX_ELEMENT,
	JSX_FRAGMENT,
	JSX_EXPRESSION_CONTAINER,
	PARENTHESIZED_EXPRESSION,
	ARRAY_EXPRESSION,
] satisfies ReadonlyArray<NodeType>);

function getWalkableJsxParent(parent: ESTree.Node): ESTree.Node | undefined {
	return WALKABLE_JSX_PARENTS.has(parent.type) ? parent : undefined;
}

function isModuleConstDeclaration(
	context: Context,
	node: ESTree.JSXElement | ESTree.JSXFragment,
	parent: ESTree.VariableDeclarator,
	current: ESTree.Node,
): boolean {
	/* v8 ignore next -- @preserve non-identifier module bindings cannot be referenced as JSX constants. */
	if (!isIdentifierName(parent.id)) return false;
	/* v8 ignore next -- @preserve walkable JSX parents are followed only through initializer positions. */
	if (parent.init !== current) return false;

	const scope = context.sourceCode.getScope(node);
	const variable = getVariableByName(scope, parent.id.name);
	return variable !== undefined && isModuleLevelScope(variable.scope);
}

function isJsxElementAssignedToModuleConst(context: Context, node: ESTree.JSXElement | ESTree.JSXFragment): boolean {
	let current: ESTree.Node = node;

	while (true) {
		const { parent } = current;
		/* v8 ignore next -- @preserve decorated parser ASTs keep JSX ancestors attached until traversal stops. */
		if (parent === null) return false;
		if (isVariableDeclarator(parent)) return isModuleConstDeclaration(context, node, parent, current);

		const nextParent = getWalkableJsxParent(parent);
		if (nextParent === undefined) return false;
		current = nextParent;
	}
}

function reportHoistableObject(context: Context, objectExpression: ESTree.ObjectExpression): void {
	const objectText = context.sourceCode.getText(objectExpression);
	context.report({
		data: { objectText },
		messageId: "hoistableObjectProp",
		node: objectExpression,
	});
}

function reportHoistableObjectProperties(context: Context, objectExpression: ESTree.ObjectExpression): void {
	/* v8 ignore next -- @preserve computed keys are explicitly treated as dynamic object props. */
	if (objectExpression.properties.some((property) => isProperty(property) && property.computed)) return;

	const seen = new Set<ESTree.Node>();
	if (isStaticExpression(context.sourceCode, objectExpression, seen, STATIC_OPTIONS)) {
		reportHoistableObject(context, objectExpression);
		return;
	}

	for (const property of objectExpression.properties) {
		/* v8 ignore next -- @preserve spread props are dynamic and already make the containing object non-static. */
		if (!isProperty(property)) continue;
		const value = unwrapExpression(property.value);
		if (isObjectExpression(value)) reportHoistableObjectProperties(context, value);
	}
}

const preferHoistedJsxObjectProperties = createRule("prefer-hoisted-jsx-object-properties", "react", {
	create(context): Visitor {
		return {
			JSXAttribute(node): void {
				const expression = getAttributeExpression(node);
				if (expression === undefined) return;

				const unwrapped = unwrapExpression(expression);
				if (!isObjectExpression(unwrapped)) return;

				const openingElement = node.parent;
				/* v8 ignore start -- @preserve JSXAttribute parents are JSXOpeningElement nodes in parser output. */
				if (!isJsxOpeningElement(openingElement)) return;
				/* v8 ignore stop -- @preserve */

				const jsxElement = openingElement.parent;
				if (isJsxElement(jsxElement) && isJsxElementAssignedToModuleConst(context, jsxElement)) return;

				reportHoistableObjectProperties(context, unwrapped);
			},
		} satisfies Visitor;
	},
	meta: {
		docs: {
			description:
				"Prefer extracting inline JSX object props to module-level constants when the entire object is statically hoistable.",
		},
		messages: {
			hoistableObjectProp:
				"Extract `{{objectText}}` to a module-level const — this inline JSX prop object is fully static and causes unnecessary reference churn on every render.",
		},
		schema: [],
		type: "suggestion",
	},
});

export default preferHoistedJsxObjectProperties;
